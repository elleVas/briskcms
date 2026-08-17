import { Module } from '@nestjs/common';
import { type BriskDb } from '@brisk/postgres-db';
import {
  DrizzlePageRepository,
  DrizzlePageVersionRepository,
} from '@brisk/postgres-page-repository';
import { AuthModule } from '../auth/auth.module.js';
import { SessionTenantContextAdapter } from '../auth/session-tenant-context.adapter.js';
import { DATABASE, DatabaseModule } from '../database.module.js';
import { PagesController } from './pages.controller.js';
import {
  PAGE_REPOSITORY,
  PAGE_VERSION_REPOSITORY,
  TENANT_CONTEXT,
} from './pages.tokens.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PagesController],
  providers: [
    {
      provide: PAGE_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzlePageRepository(db),
      inject: [DATABASE],
    },
    {
      provide: PAGE_VERSION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzlePageVersionRepository(db),
      inject: [DATABASE],
    },
    { provide: TENANT_CONTEXT, useClass: SessionTenantContextAdapter },
  ],
})
export class PagesModule {}
