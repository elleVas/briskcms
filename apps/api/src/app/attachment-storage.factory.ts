import { requireEnv } from '@brisk/env-config';
import { LocalDiskAttachmentStorageAdapter } from '@brisk/local-disk-attachment-storage';
import { S3AttachmentStorageAdapter } from '@brisk/s3-attachment-storage';
import type { AttachmentStoragePort } from '@brisk/ports';

/**
 * Reuses the exact same MEDIA_STORAGE_PROVIDER, S3_MEDIA_* (family),
 * MEDIA_UPLOAD_DIR and API_PUBLIC_URL variables as MediaModule's own
 * createMediaStorage — same underlying storage infrastructure choice per
 * deployment (local disk vs S3), a different concern (raw form
 * attachments vs the curated, image-only media library), kept apart only
 * by an "attachments" key prefix in each adapter. No separate
 * ATTACHMENT_STORAGE_PROVIDER var: a deployment that already chose S3 for
 * media almost certainly wants attachments there too, and splitting the
 * choice would just be one more variable to keep in sync for no real
 * benefit at this scale.
 */
export function createAttachmentStorage(): AttachmentStoragePort {
  const provider = process.env['MEDIA_STORAGE_PROVIDER'] ?? 'local';

  if (provider === 's3') {
    return new S3AttachmentStorageAdapter({
      bucket: requireEnv('S3_MEDIA_BUCKET'),
      region: requireEnv('S3_MEDIA_REGION'),
      endpoint: process.env['S3_MEDIA_ENDPOINT'],
      forcePathStyle: process.env['S3_MEDIA_FORCE_PATH_STYLE'] === 'true',
      accessKeyId: requireEnv('S3_MEDIA_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('S3_MEDIA_SECRET_ACCESS_KEY'),
      publicBaseUrl: requireEnv('S3_MEDIA_PUBLIC_BASE_URL'),
    });
  }

  return new LocalDiskAttachmentStorageAdapter({
    uploadDir: requireEnv('MEDIA_UPLOAD_DIR'),
    publicBaseUrl: requireEnv('API_PUBLIC_URL'),
  });
}
