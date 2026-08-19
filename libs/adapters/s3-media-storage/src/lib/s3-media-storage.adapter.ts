import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { UnsupportedMediaTypeError } from '@brisk/domain-core';
import type {
  MediaStoragePort,
  UploadMediaInput,
  UploadMediaResult,
} from '@brisk/ports';

// Same processing pipeline as LocalDiskMediaStorageAdapter (ADR-0013): one
// optimized WebP version per upload, not a size ladder. Duplicated here
// rather than extracted into a shared package — extracting it would need a
// brand new Nx library just for ~15 lines shared between two adapters,
// more architecture than the duplication costs. Revisit if a third adapter
// ever needs the same pipeline.
const MAX_DIMENSION_PX = 1600;
const WEBP_QUALITY = 82;

export interface S3MediaStorageOptions {
  bucket: string;
  region: string;
  /** Custom endpoint for an S3-compatible backend (e.g. MinIO) — omit for real AWS S3. */
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Required by MinIO (path-style bucket URLs); AWS S3 works with either. */
  forcePathStyle?: boolean;
  /** Origin (+ optional path prefix) the returned URLs are built against — same role as LocalDiskMediaStorageOptions.publicBaseUrl, e.g. a CDN in front of the bucket or the bucket's own public endpoint. */
  publicBaseUrl: string;
}

export class S3MediaStorageAdapter implements MediaStoragePort {
  readonly provider = 's3' as const;
  private readonly client: S3Client;

  constructor(private readonly options: S3MediaStorageOptions) {
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async upload(input: UploadMediaInput): Promise<UploadMediaResult> {
    if (!input.mimeType.startsWith('image/')) {
      throw new UnsupportedMediaTypeError(input.mimeType);
    }

    // rotate() with no args: auto-orients from EXIF before anything else —
    // otherwise a resize can silently bake in a sideways/upside-down photo.
    const source = sharp(input.data).rotate();
    const metadata = await source.metadata();
    const oversized =
      (metadata.width ?? 0) > MAX_DIMENSION_PX ||
      (metadata.height ?? 0) > MAX_DIMENSION_PX;

    const pipeline = oversized
      ? source.resize({
          width: MAX_DIMENSION_PX,
          height: MAX_DIMENSION_PX,
          fit: 'inside',
          withoutEnlargement: true,
        })
      : source;

    const buffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
    const outputMetadata = await sharp(buffer).metadata();

    const storageKey = `${randomUUID()}.webp`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: 'image/webp',
      }),
    );

    return {
      storageKey,
      mimeType: 'image/webp',
      size: buffer.byteLength,
      width: outputMetadata.width ?? 0,
      height: outputMetadata.height ?? 0,
    };
  }

  getUrl(storageKey: string): string {
    return `${this.options.publicBaseUrl}/${storageKey}`;
  }

  async delete(storageKey: string): Promise<void> {
    // S3's DeleteObjectCommand doesn't error on an already-missing key —
    // same idempotent-from-the-caller's-view semantics as
    // LocalDiskMediaStorageAdapter.delete(), no ENOENT-style catch needed.
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.options.bucket,
        Key: storageKey,
      }),
    );
  }
}
