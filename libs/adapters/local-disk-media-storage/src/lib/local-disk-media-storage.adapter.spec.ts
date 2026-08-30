import { randomUUID } from 'node:crypto';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { UnsupportedMediaTypeError } from '@brisk/domain-core';
import { LocalDiskMediaStorageAdapter } from './local-disk-media-storage.adapter';

async function fileExists(path: string): Promise<boolean> {
  return access(path)
    .then(() => true)
    .catch(() => false);
}

async function makePng(width: number, height: number): Promise<Uint8Array> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .png()
    .toBuffer();
}

describe('LocalDiskMediaStorageAdapter', () => {
  let uploadDir: string;
  let adapter: LocalDiskMediaStorageAdapter;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'brisk-media-test-'));
    adapter = new LocalDiskMediaStorageAdapter({
      uploadDir,
      publicBaseUrl: 'http://localhost:3000/api',
    });
  });

  afterEach(async () => {
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('converts a small image to WebP without resizing it', async () => {
    const data = await makePng(400, 300);

    const result = await adapter.upload({
      tenantId: 'tenant-1',
      siteId: 'site-1',
      filename: 'foto.png',
      mimeType: 'image/png',
      data,
    });

    expect(result.storageKey).toMatch(/\.webp$/);
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
    expect(await fileExists(join(uploadDir, result.storageKey))).toBe(true);
  });

  it('resizes an oversized image down to the max dimension', async () => {
    const data = await makePng(3000, 1500);

    const result = await adapter.upload({
      tenantId: 'tenant-1',
      siteId: 'site-1',
      filename: 'grande.png',
      mimeType: 'image/png',
      data,
    });

    expect(result.width).toBe(1600);
    expect(result.height).toBe(800);
  });

  it('rejects a non-image mime type before touching disk', async () => {
    await expect(
      adapter.upload({
        tenantId: 'tenant-1',
        siteId: 'site-1',
        filename: 'documento.pdf',
        mimeType: 'application/pdf',
        data: new Uint8Array([1, 2, 3]),
      }),
    ).rejects.toThrow(UnsupportedMediaTypeError);
  });

  it('exposes its provider as "local"', () => {
    expect(adapter.provider).toBe('local');
  });

  it('getUrl builds a URL under the configured public base', () => {
    expect(adapter.getUrl('abc.webp')).toBe(
      'http://localhost:3000/api/uploads/abc.webp',
    );
  });

  it('delete removes the file, and is idempotent if called again', async () => {
    const data = await makePng(200, 200);
    const { storageKey } = await adapter.upload({
      tenantId: 'tenant-1',
      siteId: 'site-1',
      filename: 'foto.png',
      mimeType: 'image/png',
      data,
    });
    const filePath = join(uploadDir, storageKey);
    expect(await fileExists(filePath)).toBe(true);

    await adapter.delete(storageKey);
    expect(await fileExists(filePath)).toBe(false);

    await expect(adapter.delete(storageKey)).resolves.not.toThrow();
  });

  it('delete on a never-uploaded key does not throw', async () => {
    await expect(adapter.delete(`${randomUUID()}.webp`)).resolves.not.toThrow();
  });
});
