import { LocalDiskAttachmentStorageAdapter } from '@brisk/local-disk-attachment-storage';
import { S3AttachmentStorageAdapter } from '@brisk/s3-attachment-storage';
import { createAttachmentStorage } from './attachment-storage.factory';

// Same "test the branch in isolation" reasoning as media.module.spec.ts's
// createMediaStorage tests.
describe('createAttachmentStorage', () => {
  const ENV_KEYS = [
    'MEDIA_STORAGE_PROVIDER',
    'MEDIA_UPLOAD_DIR',
    'API_PUBLIC_URL',
    'S3_MEDIA_BUCKET',
    'S3_MEDIA_REGION',
    'S3_MEDIA_ENDPOINT',
    'S3_MEDIA_FORCE_PATH_STYLE',
    'S3_MEDIA_ACCESS_KEY_ID',
    'S3_MEDIA_SECRET_ACCESS_KEY',
    'S3_MEDIA_PUBLIC_BASE_URL',
  ] as const;
  const originalValues = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const original = originalValues[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  });

  it('defaults to LocalDisk when MEDIA_STORAGE_PROVIDER is unset', () => {
    delete process.env['MEDIA_STORAGE_PROVIDER'];
    process.env['MEDIA_UPLOAD_DIR'] = './uploads';
    process.env['API_PUBLIC_URL'] = 'http://localhost:3000/api';

    expect(createAttachmentStorage()).toBeInstanceOf(
      LocalDiskAttachmentStorageAdapter,
    );
  });

  it('builds an S3AttachmentStorageAdapter when MEDIA_STORAGE_PROVIDER=s3', () => {
    process.env['MEDIA_STORAGE_PROVIDER'] = 's3';
    process.env['S3_MEDIA_BUCKET'] = 'brisk-media';
    process.env['S3_MEDIA_REGION'] = 'us-east-1';
    process.env['S3_MEDIA_ACCESS_KEY_ID'] = 'test-key';
    process.env['S3_MEDIA_SECRET_ACCESS_KEY'] = 'test-secret';
    process.env['S3_MEDIA_PUBLIC_BASE_URL'] =
      'http://localhost:9000/brisk-media';

    expect(createAttachmentStorage()).toBeInstanceOf(
      S3AttachmentStorageAdapter,
    );
  });

  it('fails fast when a required S3 variable is missing, without falling back silently', () => {
    process.env['MEDIA_STORAGE_PROVIDER'] = 's3';
    delete process.env['S3_MEDIA_BUCKET'];

    expect(() => createAttachmentStorage()).toThrow(
      /Missing required environment variable: S3_MEDIA_BUCKET/,
    );
  });
});
