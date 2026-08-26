import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalDiskAttachmentStorageAdapter } from './local-disk-attachment-storage.adapter.js';

async function fileExists(path: string): Promise<boolean> {
  return access(path)
    .then(() => true)
    .catch(() => false);
}

describe('LocalDiskAttachmentStorageAdapter', () => {
  let uploadDir: string;
  let adapter: LocalDiskAttachmentStorageAdapter;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'brisk-attachment-test-'));
    adapter = new LocalDiskAttachmentStorageAdapter({
      uploadDir,
      publicBaseUrl: 'http://localhost:3000/api',
    });
  });

  afterEach(async () => {
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('writes a non-image file as-is under an attachments/ subfolder', async () => {
    const data = new TextEncoder().encode('%PDF-1.4 fake pdf content');

    const result = await adapter.upload({
      filename: 'cv.pdf',
      mimeType: 'application/pdf',
      extension: 'pdf',
      data,
    });

    expect(result.filename).toBe('cv.pdf');
    expect(result.url).toMatch(
      /^http:\/\/localhost:3000\/api\/uploads\/attachments\/[\w-]+\.pdf$/,
    );
    const storageKey = result.url.split('/attachments/')[1];
    expect(await fileExists(join(uploadDir, 'attachments', storageKey))).toBe(
      true,
    );
  });

  it('preserves the original filename in the result even though the storage key is randomized', async () => {
    const data = new TextEncoder().encode('hello');

    const result1 = await adapter.upload({
      filename: 'note.txt',
      mimeType: 'text/plain',
      extension: 'txt',
      data,
    });
    const result2 = await adapter.upload({
      filename: 'note.txt',
      mimeType: 'text/plain',
      extension: 'txt',
      data,
    });

    expect(result1.url).not.toBe(result2.url);
    expect(result1.filename).toBe('note.txt');
    expect(result2.filename).toBe('note.txt');
  });
});
