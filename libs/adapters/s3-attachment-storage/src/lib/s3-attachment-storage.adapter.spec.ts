import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { S3Client } from '@aws-sdk/client-s3';
import { S3AttachmentStorageAdapter } from './s3-attachment-storage.adapter.js';

const sendMock = vi.fn();

// Same mocking approach as s3-media-storage's own spec — no real
// bucket/MinIO needed, assert on the command objects passed to send().
vi.mock('@aws-sdk/client-s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-s3')>();
  return {
    ...actual,
    S3Client: vi.fn().mockImplementation(function S3ClientMock() {
      return { send: sendMock };
    }),
  };
});

describe('S3AttachmentStorageAdapter', () => {
  let adapter: S3AttachmentStorageAdapter;

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
    adapter = new S3AttachmentStorageAdapter({
      bucket: 'brisk-attachments',
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      publicBaseUrl: 'https://attachments.example.com',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uploads a non-image file as-is under an attachments/ key prefix', async () => {
    const data = new TextEncoder().encode('%PDF-1.4 fake pdf content');

    const result = await adapter.upload({
      filename: 'cv.pdf',
      mimeType: 'application/pdf',
      extension: 'pdf',
      data,
    });

    expect(result.filename).toBe('cv.pdf');
    expect(result.url).toMatch(
      /^https:\/\/attachments\.example\.com\/attachments\/[\w-]+\.pdf$/,
    );
    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command.input.Bucket).toBe('brisk-attachments');
    expect(command.input.Key).toMatch(/^attachments\/[\w-]+\.pdf$/);
    expect(command.input.ContentType).toBe('application/pdf');
  });

  it('passes a custom endpoint and forcePathStyle through to the client (MinIO)', () => {
    vi.mocked(S3Client).mockClear();

    new S3AttachmentStorageAdapter({
      bucket: 'brisk-attachments',
      region: 'us-east-1',
      endpoint: 'http://localhost:9000',
      forcePathStyle: true,
      accessKeyId: 'x',
      secretAccessKey: 'y',
      publicBaseUrl: 'http://localhost:9000/brisk-attachments',
    });

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
      }),
    );
  });
});
