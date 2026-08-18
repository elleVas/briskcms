import { Module } from '@nestjs/common';
import { type BriskDb } from '@brisk/postgres-db';
import { DrizzleSiteRepository } from '@brisk/postgres-site-repository';
import { AuthModule } from '../auth/auth.module.js';
import { SessionTenantContextAdapter } from '../auth/session-tenant-context.adapter.js';
import { DATABASE, DatabaseModule } from '../database.module.js';
import { SitesController } from './sites.controller.js';
import { SITE_REPOSITORY, TENANT_CONTEXT } from './sites.tokens.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SitesController],
  providers: [
    {
      provide: SITE_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleSiteRepository(db),
      inject: [DATABASE],
    },
    { provide: TENANT_CONTEXT, useClass: SessionTenantContextAdapter },
  ],
})
export class SitesModule {}
