import { S3Client, CopyObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config/env';
import { ReleaseWithDetails } from '../types/ddex';
import {
  getAudioSaladAudioFilename,
  getAudioSaladImageFilename,
  getAudioSaladXmlFilename,
} from './AudioSalad_ddexGenerator';

export class SourceFileMissingError extends Error {
  constructor(public readonly missingUrls: string[]) {
    super(`Source files not found in S3: ${missingUrls.join(', ')}`);
    this.name = 'SourceFileMissingError';
  }
}

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

async function validateSourceExists(url: string): Promise<boolean> {
  const { bucket, key } = parseS3Url(url);
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err: any) {
    if (err.$metadata?.httpStatusCode === 404 || err.name === 'NotFound' || err.name === 'NoSuchKey') {
      return false;
    }
    throw err;
  }
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

  // Pre-flight: verify all source files exist before touching the ingest bucket
  const missingUrls: string[] = [];
  for (const track of tracks) {
    if (track.sound_url && !(await validateSourceExists(track.sound_url))) {
      missingUrls.push(track.sound_url);
    }
  }
  if (release.front_pic && !(await validateSourceExists(release.front_pic))) {
    missingUrls.push(release.front_pic);
  }
  if (missingUrls.length > 0) {
    console.error(`[S3] Pre-flight failed — missing source files:`, missingUrls);
    throw new SourceFileMissingError(missingUrls);
  }

  try {
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
  } catch (err) {
    console.error(`[S3] Upload failed for UPC ${release.upc}, rolling back ${uploadedFiles.length} uploaded files`, err);
    await deleteReleaseFromS3(release.upc);
    throw err;
  }

  console.log(`[S3] Done. ${uploadedFiles.length} files in ${destPrefix}:`, uploadedFiles);

  return {
    s3_bucket: config.s3.ingestBucket,
    s3_path: destPrefix,
    files: uploadedFiles,
  };
}

export async function checkDeliveryComplete(upc: string): Promise<boolean> {
  const key = `${config.s3.ingestBasePath}/${upc}/delivery.complete`;
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: config.s3.ingestBucket, Key: key }));
    return true;
  } catch (err: any) {
    if (err.$metadata?.httpStatusCode === 404 || err.name === 'NotFound' || err.name === 'NoSuchKey') {
      return false;
    }
    throw err;
  }
}

export async function deleteReleaseFromS3(upc: string): Promise<{ deleted: string[] }> {
  const prefix = `${config.s3.ingestBasePath}/${upc}/`;

  console.log(`[S3] Listing objects to delete: ${config.s3.ingestBucket}/${prefix}`);
  const listResult = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: config.s3.ingestBucket,
      Prefix: prefix,
    })
  );

  const objects = listResult.Contents ?? [];

  if (objects.length === 0) {
    console.log(`[S3] No files found under ${prefix}`);
    return { deleted: [] };
  }

  await s3Client.send(
    new DeleteObjectsCommand({
      Bucket: config.s3.ingestBucket,
      Delete: {
        Objects: objects.map((o) => ({ Key: o.Key! })),
        Quiet: true,
      },
    })
  );

  const deleted = objects.map((o) => o.Key!.replace(prefix, ''));
  console.log(`[S3] Deleted ${deleted.length} files from ${prefix}:`, deleted);
  return { deleted };
}
