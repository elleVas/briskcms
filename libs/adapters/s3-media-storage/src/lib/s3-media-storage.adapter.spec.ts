import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { S3Client } from '@aws-sdk/client-s3';
import { UnsupportedMediaTypeError } from '@brisk/domain-core';
import { S3MediaStorageAdapter } from './s3-media-storage.adapter.js';

const sendMock = vi.fn();

// No real bucket/MinIO needed for these — the S3Client itself is mocked,
// so upload()/delete() are verified by asserting on the command objects
// passed to send(), not by hitting a real endpoint.
vi.mock('@aws-sdk/client-s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-s3')>();
  return {
    ...actual,
    // A plain function (not an arrow) so `new S3Client(...)` works — the
    // constructor's object return overrides `this`, same trick `vi.fn()`
    // itself can't do with an arrow-function implementation.
    S3Client: vi.fn().mockImplementation(function S3ClientMock() {
      return { send: sendMock };
    }),
  };
});

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

describe('S3MediaStorageAdapter', () => {
  let adapter: S3MediaStorageAdapter;

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
    adapter = new S3MediaStorageAdapter({
      bucket: 'brisk-media',
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      publicBaseUrl: 'https://media.example.com',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('converts a small image to WebP and uploads it under a generated key', async () => {
    const data = await makePng(400, 300);

    const result = await adapter.upload({
      tenantId: 'tenant-1',
      siteId: 'site-1',
      filename: 'foto.png',
      mimeType: 'image/png',
      data,
    });

    expect(result.storageKey).toMatch(/\.webp$/);
    expect(result.mimeType).toBe('image/webp');
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command.input.Bucket).toBe('brisk-media');
    expect(command.input.Key).toBe(result.storageKey);
    expect(command.input.ContentType).toBe('image/webp');
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

  it('rejects a non-image mime type before touching S3', async () => {
    await expect(
      adapter.upload({
        tenantId: 'tenant-1',
        siteId: 'site-1',
        filename: 'documento.pdf',
        mimeType: 'application/pdf',
        data: new Uint8Array([1, 2, 3]),
      }),
    ).rejects.toThrow(UnsupportedMediaTypeError);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('exposes its provider as "s3"', () => {
    expect(adapter.provider).toBe('s3');
  });

  it('getUrl builds a URL under the configured public base', () => {
    expect(adapter.getUrl('abc.webp')).toBe(
      'https://media.example.com/abc.webp',
    );
  });

  it('delete sends a DeleteObjectCommand for the bucket/key, and never throws for a missing key', async () => {
    await adapter.delete('abc.webp');

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command.input.Bucket).toBe('brisk-media');
    expect(command.input.Key).toBe('abc.webp');
  });

  it('passes a custom endpoint and forcePathStyle through to the client (MinIO)', () => {
    vi.mocked(S3Client).mockClear();

    new S3MediaStorageAdapter({
      bucket: 'brisk-media',
      region: 'us-east-1',
      endpoint: 'http://localhost:9000',
      forcePathStyle: true,
      accessKeyId: 'x',
      secretAccessKey: 'y',
      publicBaseUrl: 'http://localhost:9000/brisk-media',
    });

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
      }),
    );
  });
});
