export interface UploadAttachmentInput {
  filename: string;
  /** Must already be the sniffed, verified MIME type — see
   * sniffAttachmentType in @brisk/domain-core — never the raw
   * client-declared one. */
  mimeType: string;
  /** No leading dot. Must already be the sniffed, verified extension —
   * the storage key is built from this, never from `filename`, which is
   * client-controlled on this unauthenticated upload path. */
  extension: string;
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
