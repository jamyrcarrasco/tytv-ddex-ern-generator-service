import { S3Client, CopyObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { config } from '../config/env';
import { ReleaseWithDetails } from '../types/ddex';
import {
  getAudioSaladAudioFilename,
  getAudioSaladImageFilename,
  getAudioSaladXmlFilename,
} from './AudioSalad_ddexGenerator';
import logger from '../config/logger';

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
  maxAttempts: config.s3.maxAttempts,
  requestHandler: new NodeHttpHandler({
    connectionTimeout: config.s3.connectionTimeout,
    requestTimeout: config.s3.requestTimeout,
  }),
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
    return {
      bucket: hostParts[0],
      key: parsed.pathname.substring(1),
    };
  }

  const pathParts = parsed.pathname.substring(1).split('/');
  return {
    bucket: pathParts[0],
    key: pathParts.slice(1).join('/'),
  };
}

async function copyS3Object(sourceUrl: string, destKey: string): Promise<void> {
  const { bucket: sourceBucket, key: sourceKey } = parseS3Url(sourceUrl);
  const copySource = `${sourceBucket}/${sourceKey}`;

  logger.info({ destKey, copySource }, 'S3 copy started');
  await s3Client.send(
    new CopyObjectCommand({
      CopySource: copySource,
      Bucket: config.s3.ingestBucket,
      Key: destKey,
    })
  );
  logger.info({ destKey }, 'S3 copy done');
}

async function uploadContent(destKey: string, body: string, contentType: string): Promise<void> {
  logger.info({ destKey, contentType, bytes: body.length }, 'S3 upload started');
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.s3.ingestBucket,
      Key: destKey,
      Body: body,
      ContentType: contentType,
    })
  );
  logger.info({ destKey }, 'S3 upload done');
}

export async function uploadReleaseForAudioSalad(
  releaseData: ReleaseWithDetails,
  xmlContent: string
): Promise<S3UploadResult> {
  const { release, tracks } = releaseData;
  const destPrefix = `${config.s3.ingestBasePath}/${release.upc}`;
  const uploadedFiles: string[] = [];

  logger.info({ releaseId: release.id, upc: release.upc, trackCount: tracks.length }, 'AudioSalad upload started');

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
    logger.error({ releaseId: release.id, upc: release.upc, missingUrls }, 'Pre-flight failed — missing source files');
    throw new SourceFileMissingError(missingUrls);
  }

  try {
    for (const track of tracks) {
      if (track.sound_url) {
        const filename = getAudioSaladAudioFilename(release.upc, track.number, track.sound_url);
        logger.info({ releaseId: release.id, upc: release.upc, track: track.song_name, filename }, 'Copying audio file');
        await copyS3Object(track.sound_url, `${destPrefix}/${filename}`);
        uploadedFiles.push(filename);
      } else {
        logger.warn({ releaseId: release.id, upc: release.upc, track: track.song_name }, 'Track has no sound_url, skipping');
      }
    }

    if (release.front_pic) {
      const filename = getAudioSaladImageFilename(release.upc, release.front_pic);
      logger.info({ releaseId: release.id, upc: release.upc, filename }, 'Copying cover image');
      await copyS3Object(release.front_pic, `${destPrefix}/${filename}`);
      uploadedFiles.push(filename);
    } else {
      logger.warn({ releaseId: release.id, upc: release.upc }, 'Release has no cover image');
    }

    const xmlFilename = getAudioSaladXmlFilename(release.upc);
    await uploadContent(`${destPrefix}/${xmlFilename}`, xmlContent, 'application/xml');
    uploadedFiles.push(xmlFilename);

    const handshakeFilename = 'delivery.complete';
    await uploadContent(`${destPrefix}/${handshakeFilename}`, '', 'application/octet-stream');
    uploadedFiles.push(handshakeFilename);
  } catch (err) {
    logger.error({ err, releaseId: release.id, upc: release.upc, uploadedCount: uploadedFiles.length }, 'Upload failed, rolling back');
    await deleteReleaseFromS3(release.upc);
    throw err;
  }

  logger.info({ releaseId: release.id, upc: release.upc, files: uploadedFiles }, 'AudioSalad upload complete');

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

  logger.info({ upc, prefix }, 'Listing S3 objects for deletion');
  const listResult = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: config.s3.ingestBucket,
      Prefix: prefix,
    })
  );

  const objects = listResult.Contents ?? [];

  if (objects.length === 0) {
    logger.info({ upc }, 'No files found for deletion');
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
  logger.info({ upc, deletedCount: deleted.length, files: deleted }, 'S3 deletion complete');
  return { deleted };
}
