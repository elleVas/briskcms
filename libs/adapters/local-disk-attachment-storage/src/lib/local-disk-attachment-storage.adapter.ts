import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import type {
  AttachmentStoragePort,
  UploadAttachmentInput,
  UploadAttachmentResult,
} from '@brisk/ports';

export interface LocalDiskAttachmentStorageOptions {
  /** Written under `${uploadDir}/attachments` — a subfolder of the same
   * directory MediaStoragePort's own LocalDisk adapter serves from
   * (apps/api's main.ts already serves the whole tree via express.static,
   * no extra route needed), kept in its own prefix so a form attachment
   * is never mistaken for a curated media-library image. */
  uploadDir: string;
  /** Origin the returned URLs are built against — same role as MediaStoragePort's own publicBaseUrl. */
  publicBaseUrl: string;
}

/** No image processing of any kind, unlike MediaStoragePort's LocalDisk adapter — raw bytes in, raw bytes out. */
export class LocalDiskAttachmentStorageAdapter implements AttachmentStoragePort {
  constructor(private readonly options: LocalDiskAttachmentStorageOptions) {}

  async upload(input: UploadAttachmentInput): Promise<UploadAttachmentResult> {
    const attachmentsDir = join(this.options.uploadDir, 'attachments');
    await mkdir(attachmentsDir, { recursive: true });

    const storageKey = `${randomUUID()}${extname(input.filename)}`;
    await writeFile(join(attachmentsDir, storageKey), input.data);

    return {
      url: `${this.options.publicBaseUrl}/uploads/attachments/${storageKey}`,
      filename: input.filename,
    };
  }
}
