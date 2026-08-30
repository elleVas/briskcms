import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import { DrizzleMediaRepository } from '@brisk/postgres-media-repository';
import { LocalDiskMediaStorageAdapter } from '@brisk/local-disk-media-storage';
import { S3MediaStorageAdapter } from '@brisk/s3-media-storage';
import type { MediaStoragePort } from '@brisk/ports';
import { AuthModule } from '../auth/auth.module';
import { DATABASE, DatabaseModule } from '../database.module';
import { MediaController } from './media.controller';
import { MEDIA_REPOSITORY, MEDIA_STORAGE } from './media.tokens';

/**
 * 'local' unless MEDIA_STORAGE_PROVIDER is explicitly set to 's3' — every
 * self-hosted deployment today has no such variable set at all and must
 * keep working exactly as before, unchanged (ADR-0013's LocalDisk default).
 * S3-specific variables are only required (requireEnv, fail loud) once the
 * provider has actually been opted into — a LocalDisk-only deployment
 * should never need to set S3 credentials just to boot.
 */
export function createMediaStorage(): MediaStoragePort {
  const provider = process.env['MEDIA_STORAGE_PROVIDER'] ?? 'local';

  if (provider === 's3') {
    return new S3MediaStorageAdapter({
      bucket: requireEnv('S3_MEDIA_BUCKET'),
      region: requireEnv('S3_MEDIA_REGION'),
      endpoint: process.env['S3_MEDIA_ENDPOINT'],
      forcePathStyle: process.env['S3_MEDIA_FORCE_PATH_STYLE'] === 'true',
      accessKeyId: requireEnv('S3_MEDIA_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('S3_MEDIA_SECRET_ACCESS_KEY'),
      publicBaseUrl: requireEnv('S3_MEDIA_PUBLIC_BASE_URL'),
    });
  }

  return new LocalDiskMediaStorageAdapter({
    uploadDir: requireEnv('MEDIA_UPLOAD_DIR'),
    publicBaseUrl: requireEnv('API_PUBLIC_URL'),
  });
}

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    // Security review 2026-08-24, "terzo giro": l'upload media autenticato
    // non aveva alcun rate limiting — un singolo account compromesso
    // poteva riempire lo storage senza alcun limite. 30/minuto per IP è
    // generoso per un editor legittimo che carica più immagini in
    // sequenza, ma limita un abuso automatizzato.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 30 }] }),
  ],
  controllers: [MediaController],
  providers: [
    {
      provide: MEDIA_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleMediaRepository(db),
      inject: [DATABASE],
    },
    {
      provide: MEDIA_STORAGE,
      useFactory: createMediaStorage,
    },
  ],
})
export class MediaModule {}
