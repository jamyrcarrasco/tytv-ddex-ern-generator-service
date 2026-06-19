import { S3Client, CopyObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config/env';
import { ReleaseWithDetails } from '../types/ddex';

const s3Client = new S3Client({
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
});

export interface S3UploadResult {
  s3_bucket: string;
  s3_path: string;
  files: string[];
}

/**
 * Parses a full S3 URL into bucket and key.
 * Supports path-style: https://bucket.s3.amazonaws.com/key
 * and virtual-hosted-style: https://s3.amazonaws.com/bucket/key
 */
function parseS3Url(url: string): { bucket: string; key: string } {
  const parsed = new URL(url);
  const hostParts = parsed.hostname.split('.');

  if (hostParts[1] === 's3') {
    // Virtual-hosted style: bucket.s3.region.amazonaws.com/key
    return {
      bucket: hostParts[0],
      key: parsed.pathname.substring(1),
    };
  }

  // Path style: s3.amazonaws.com/bucket/key
  const pathParts = parsed.pathname.substring(1).split('/');
  return {
    bucket: pathParts[0],
    key: pathParts.slice(1).join('/'),
  };
}

function extractFilename(url: string): string {
  try {
    return new URL(url).pathname.split('/').pop() || url;
  } catch {
    return url.split('/').pop() || url;
  }
}

async function copyS3Object(sourceUrl: string, destKey: string): Promise<void> {
  const { bucket: sourceBucket, key: sourceKey } = parseS3Url(sourceUrl);
  const copySource = `${sourceBucket}/${sourceKey}`;

  console.log(`[S3] Copying: ${copySource} → ${config.s3.ingestBucket}/${destKey}`);
  await s3Client.send(
    new CopyObjectCommand({
      CopySource: copySource,
      Bucket: config.s3.ingestBucket,
      Key: destKey,
    })
  );
  console.log(`[S3] Copied OK: ${destKey}`);
}

async function uploadXml(destKey: string, xmlContent: string): Promise<void> {
  console.log(`[S3] Uploading XML → ${config.s3.ingestBucket}/${destKey} (${xmlContent.length} bytes)`);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.s3.ingestBucket,
      Key: destKey,
      Body: xmlContent,
      ContentType: 'application/xml',
    })
  );
  console.log(`[S3] XML uploaded OK: ${destKey}`);
}

export async function uploadReleaseForAudioSalad(
  releaseData: ReleaseWithDetails,
  xmlContent: string
): Promise<S3UploadResult> {
  const { release, tracks } = releaseData;
  const destPrefix = `${config.s3.ingestBasePath}/release-${release.id}`;
  const copiedFiles: string[] = [];

  console.log(`[S3] Starting upload for release ${release.id} → ${config.s3.ingestBucket}/${destPrefix}`);
  console.log(`[S3] Tracks to copy: ${tracks.length}`);

  // Copy audio files
  for (const track of tracks) {
    if (track.sound_url) {
      const filename = extractFilename(track.sound_url);
      console.log(`[S3] [${tracks.indexOf(track) + 1}/${tracks.length}] Audio: ${track.song_name} (${filename})`);
      await copyS3Object(track.sound_url, `${destPrefix}/${filename}`);
      copiedFiles.push(filename);
    } else {
      console.warn(`[S3] Track "${track.song_name}" has no sound_url, skipping`);
    }
  }

  // Copy cover image
  if (release.front_pic) {
    const filename = extractFilename(release.front_pic);
    console.log(`[S3] Cover image: ${filename}`);
    await copyS3Object(release.front_pic, `${destPrefix}/${filename}`);
    copiedFiles.push(filename);
  } else {
    console.warn(`[S3] Release ${release.id} has no cover image`);
  }

  // Upload XML
  const xmlFilename = `release-${release.id}_ddex.xml`;
  await uploadXml(`${destPrefix}/${xmlFilename}`, xmlContent);
  copiedFiles.push(xmlFilename);

  // Upload handshake file to signal transfer is complete
  const handshakeFilename = 'delivery.complete';
  console.log(`[S3] Uploading handshake file → ${destPrefix}/${handshakeFilename}`);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.s3.ingestBucket,
      Key: `${destPrefix}/${handshakeFilename}`,
      Body: '',
      ContentType: 'application/octet-stream',
    })
  );
  console.log(`[S3] Handshake file uploaded OK: ${handshakeFilename}`);
  copiedFiles.push(handshakeFilename);

  console.log(`[S3] Done. ${copiedFiles.length} files in ${destPrefix}:`, copiedFiles);

  return {
    s3_bucket: config.s3.ingestBucket,
    s3_path: destPrefix,
    files: copiedFiles,
  };
}
