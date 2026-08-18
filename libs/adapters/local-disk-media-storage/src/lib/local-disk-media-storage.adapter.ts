import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { UnsupportedMediaTypeError } from '@brisk/domain-core';
import type {
  MediaStoragePort,
  UploadMediaInput,
  UploadMediaResult,
} from '@brisk/ports';

// One optimized version per upload (resized if oversized, converted to
// WebP), not a size ladder — see ADR-0013 for why, and the note on
// extending this later if a real need for separate thumbnails shows up.
const MAX_DIMENSION_PX = 1600;
const WEBP_QUALITY = 82;

export interface LocalDiskMediaStorageOptions {
  /** Absolute path files are written to and served from (see ADR-0013 —
   * apps/api serves this directory directly, no separate reverse-proxy route). */
  uploadDir: string;
  /** Origin the returned URLs are built against, e.g. http://localhost:3000/api. */
  publicBaseUrl: string;
}

export class LocalDiskMediaStorageAdapter implements MediaStoragePort {
  readonly provider = 'local' as const;

  constructor(private readonly options: LocalDiskMediaStorageOptions) {}

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

    await mkdir(this.options.uploadDir, { recursive: true });
    const storageKey = `${randomUUID()}.webp`;
    await writeFile(join(this.options.uploadDir, storageKey), buffer);

    return {
      storageKey,
      mimeType: 'image/webp',
      size: buffer.byteLength,
      width: outputMetadata.width ?? 0,
      height: outputMetadata.height ?? 0,
    };
  }

  getUrl(storageKey: string): string {
    return `${this.options.publicBaseUrl}/uploads/${storageKey}`;
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await unlink(join(this.options.uploadDir, storageKey));
    } catch (error) {
      // Already gone is fine — delete is idempotent from the caller's
      // point of view (matches PageRepositoryPort.delete's semantics).
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
