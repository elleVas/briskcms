import { Module } from '@nestjs/common';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import {
  DrizzlePageRepository,
  DrizzlePageVersionRepository,
} from '@brisk/postgres-page-repository';
import { PreviewTokenAdapter } from '@brisk/preview-token-adapter';
import { DrizzleSearchRepository } from '@brisk/postgres-search-repository';
import { AuthModule } from '../auth/auth.module.js';
import { SessionTenantContextAdapter } from '../auth/session-tenant-context.adapter.js';
import { DATABASE, DatabaseModule } from '../database.module.js';
import { PagesController } from './pages.controller.js';
import {
  DEFAULT_TENANT_ID,
  PAGE_REPOSITORY,
  PAGE_VERSION_REPOSITORY,
  PREVIEW_TOKEN_PORT,
  SEARCH_REPOSITORY,
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
    {
      provide: SEARCH_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleSearchRepository(db),
      inject: [DATABASE],
    },
    { provide: TENANT_CONTEXT, useClass: SessionTenantContextAdapter },
    // Locale a questo modulo, non importato da AuthModule (che non lo
    // esporta) — stessa scelta di public-pages.module.ts.
    {
      provide: DEFAULT_TENANT_ID,
      useFactory: (): string => requireEnv('DEFAULT_TENANT_ID'),
    },
    {
      provide: PREVIEW_TOKEN_PORT,
      useFactory: (db: BriskDb, tenantId: string) =>
        new PreviewTokenAdapter(db, tenantId),
      inject: [DATABASE, DEFAULT_TENANT_ID],
    },
  ],
})
export class PagesModule {}
