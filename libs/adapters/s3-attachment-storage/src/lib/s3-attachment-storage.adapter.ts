import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type {
  AttachmentStoragePort,
  UploadAttachmentInput,
  UploadAttachmentResult,
} from '@brisk/ports';

export interface S3AttachmentStorageOptions {
  bucket: string;
  region: string;
  /** Custom endpoint for an S3-compatible backend (e.g. MinIO) — omit for real AWS S3. */
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  /** Origin the returned URLs are built against — same role as MediaStoragePort's own publicBaseUrl. */
  publicBaseUrl: string;
}

/** No image processing of any kind, unlike MediaStoragePort's S3 adapter — raw bytes in, raw bytes out. Same "attachments/" key prefix reasoning as the LocalDisk sibling adapter. */
export class S3AttachmentStorageAdapter implements AttachmentStoragePort {
  private readonly client: S3Client;

  constructor(private readonly options: S3AttachmentStorageOptions) {
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

  async upload(input: UploadAttachmentInput): Promise<UploadAttachmentResult> {
    const storageKey = `attachments/${randomUUID()}${extname(input.filename)}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: storageKey,
        Body: input.data,
        ContentType: input.mimeType,
      }),
    );

    return {
      url: `${this.options.publicBaseUrl}/${storageKey}`,
      filename: input.filename,
    };
  }
}
