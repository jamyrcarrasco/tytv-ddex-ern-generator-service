import { S3Client, CopyObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config/env';
import { ReleaseWithDetails } from '../types/ddex';
import {
  getAudioSaladAudioFilename,
  getAudioSaladImageFilename,
  getAudioSaladXmlFilename,
} from './AudioSalad_ddexGenerator';

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

async function uploadContent(destKey: string, body: string, contentType: string): Promise<void> {
  console.log(`[S3] Uploading → ${config.s3.ingestBucket}/${destKey} (${body.length} bytes, ${contentType})`);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.s3.ingestBucket,
      Key: destKey,
      Body: body,
      ContentType: contentType,
    })
  );
  console.log(`[S3] Uploaded OK: ${destKey}`);
}

export async function uploadReleaseForAudioSalad(
  releaseData: ReleaseWithDetails,
  xmlContent: string
): Promise<S3UploadResult> {
  const { release, tracks } = releaseData;
  // AudioSalad folder is named by UPC, not release ID
  const destPrefix = `${config.s3.ingestBasePath}/${release.upc}`;
  const uploadedFiles: string[] = [];

  console.log(`[S3] Starting upload for release ${release.id} (UPC: ${release.upc}) → ${config.s3.ingestBucket}/${destPrefix}`);
  console.log(`[S3] Tracks to copy: ${tracks.length}`);

  // Copy audio files with AudioSalad naming: {UPC}_1_{trackNumber}.{ext}
  for (const track of tracks) {
    if (track.sound_url) {
      const filename = getAudioSaladAudioFilename(release.upc, track.number, track.sound_url);
      console.log(`[S3] [${tracks.indexOf(track) + 1}/${tracks.length}] Audio: "${track.song_name}" → ${filename}`);
      await copyS3Object(track.sound_url, `${destPrefix}/${filename}`);
      uploadedFiles.push(filename);
    } else {
      console.warn(`[S3] Track "${track.song_name}" has no sound_url, skipping`);
    }
  }

  // Copy cover image with AudioSalad naming: {UPC}.{ext}
  if (release.front_pic) {
    const filename = getAudioSaladImageFilename(release.upc, release.front_pic);
    console.log(`[S3] Cover image → ${filename}`);
    await copyS3Object(release.front_pic, `${destPrefix}/${filename}`);
    uploadedFiles.push(filename);
  } else {
    console.warn(`[S3] Release ${release.id} has no cover image`);
  }

  // Upload XML with AudioSalad naming: {UPC}.xml
  const xmlFilename = getAudioSaladXmlFilename(release.upc);
  await uploadContent(`${destPrefix}/${xmlFilename}`, xmlContent, 'application/xml');
  uploadedFiles.push(xmlFilename);

  // Upload delivery.complete handshake file
  const handshakeFilename = 'delivery.complete';
  console.log(`[S3] Uploading handshake → ${destPrefix}/${handshakeFilename}`);
  await uploadContent(`${destPrefix}/${handshakeFilename}`, '', 'application/octet-stream');
  uploadedFiles.push(handshakeFilename);

  console.log(`[S3] Done. ${uploadedFiles.length} files in ${destPrefix}:`, uploadedFiles);

  return {
    s3_bucket: config.s3.ingestBucket,
    s3_path: destPrefix,
    files: uploadedFiles,
  };
}
