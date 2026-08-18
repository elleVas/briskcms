import { Module } from '@nestjs/common';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import { DrizzleMediaRepository } from '@brisk/postgres-media-repository';
import { LocalDiskMediaStorageAdapter } from '@brisk/local-disk-media-storage';
import { AuthModule } from '../auth/auth.module.js';
import { DATABASE, DatabaseModule } from '../database.module.js';
import { SessionTenantContextAdapter } from '../auth/session-tenant-context.adapter.js';
import { MediaController } from './media.controller.js';
import {
  API_PUBLIC_URL,
  MEDIA_REPOSITORY,
  MEDIA_STORAGE,
  MEDIA_UPLOAD_DIR,
  TENANT_CONTEXT,
} from './media.tokens.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [MediaController],
  providers: [
    {
      provide: MEDIA_UPLOAD_DIR,
      useFactory: (): string => requireEnv('MEDIA_UPLOAD_DIR'),
    },
    {
      provide: API_PUBLIC_URL,
      useFactory: (): string => requireEnv('API_PUBLIC_URL'),
    },
    {
      provide: MEDIA_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleMediaRepository(db),
      inject: [DATABASE],
    },
    {
      provide: MEDIA_STORAGE,
      // LocalDisk is the only adapter wired in for now — see ADR-0013.
      // S3CompatibleAdapter slots in here later behind the same
      // MediaStoragePort, no controller/use-case changes needed.
      useFactory: (uploadDir: string, publicBaseUrl: string) =>
        new LocalDiskMediaStorageAdapter({ uploadDir, publicBaseUrl }),
      inject: [MEDIA_UPLOAD_DIR, API_PUBLIC_URL],
    },
    { provide: TENANT_CONTEXT, useClass: SessionTenantContextAdapter },
  ],
})
export class MediaModule {}
