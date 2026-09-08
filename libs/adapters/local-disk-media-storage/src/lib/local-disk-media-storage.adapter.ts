import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { sniffMediaType } from '@brisk/domain-core';
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
    // The file's own bytes decide, not the declared type (ADR-0054): a
    // caller can set any header it likes, and for video and audio — which
    // are stored exactly as uploaded, since sharp cannot re-encode them —
    // this is the only check there will ever be. It throws
    // UnsupportedMediaTypeError for anything not on the allow-list.
    const sniffed = sniffMediaType(input.data);

    if (sniffed.kind !== 'image') {
      await mkdir(this.options.uploadDir, { recursive: true });
      const key = `${randomUUID()}.${sniffed.extension}`;
      await writeFile(join(this.options.uploadDir, key), input.data);
      return {
        storageKey: key,
        mimeType: sniffed.mimeType,
        size: input.data.byteLength,
        // A video has pixel dimensions and an audio file does not, but
        // reading a container's dimensions means decoding it — a
        // different kind of dependency than sharp. Left unset rather than
        // guessed: `width`/`height` are nullable for exactly this, and
        // nothing in the renderer needs them for these two.
        width: 0,
        height: 0,
      };
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
