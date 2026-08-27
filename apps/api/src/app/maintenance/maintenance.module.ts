import { Module } from '@nestjs/common';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import { DATABASE, DatabaseModule } from '../database.module.js';
import { ExpiredTokensCleanupService } from './expired-tokens-cleanup.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: ExpiredTokensCleanupService,
      useFactory: (db: BriskDb) =>
        new ExpiredTokensCleanupService(db, requireEnv('DEFAULT_TENANT_ID')),
      inject: [DATABASE],
    },
  ],
})
export class MaintenanceModule {}
