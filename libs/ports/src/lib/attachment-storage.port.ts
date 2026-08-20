export interface UploadAttachmentInput {
  filename: string;
  mimeType: string;
  data: Uint8Array;
}

export interface UploadAttachmentResult {
  url: string;
  filename: string;
}

/**
 * Implemented by @brisk/local-disk-attachment-storage and
 * @brisk/s3-attachment-storage — raw byte storage for a form's file-upload
 * field, no image processing of any kind (unlike MediaStoragePort, which
 * is dedicated to the curated media library and rejects non-image files
 * outright, see ADR-0013 — a CV/PDF attached to a contact form would be
 * rejected by that port, not just mishandled). Reuses the same
 * MEDIA_STORAGE_PROVIDER/S3_MEDIA_* config as MediaStoragePort (apps/api's
 * createAttachmentStorage) — same underlying storage infrastructure
 * choice per deployment, a different concern, stored under its own key
 * prefix so the two never mix.
 */
export interface AttachmentStoragePort {
  upload(input: UploadAttachmentInput): Promise<UploadAttachmentResult>;
}
