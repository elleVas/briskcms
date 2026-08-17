export interface UploadMediaInput {
  tenantId: string;
  siteId: string;
  filename: string;
  mimeType: string;
  data: Uint8Array;
}

export interface UploadMediaResult {
  storageKey: string;
  size: number;
  width: number | null;
  height: number | null;
}

/** Implementata da LocalDiskAdapter (default) e S3CompatibleAdapter — vedi libs/adapters. */
export interface MediaStoragePort {
  upload(input: UploadMediaInput): Promise<UploadMediaResult>;
  getUrl(storageKey: string): string;
  delete(storageKey: string): Promise<void>;
}
