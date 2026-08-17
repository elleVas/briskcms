import { Module } from '@nestjs/common';
import { type BriskDb, createAppDb } from '@brisk/postgres-db';
import {
  DrizzlePageRepository,
  DrizzlePageVersionRepository,
} from '@brisk/postgres-page-repository';
import { PagesController } from './pages.controller.js';
import { StaticTenantContextAdapter } from './static-tenant-context.adapter.js';
import {
  DATABASE,
  PAGE_REPOSITORY,
  PAGE_VERSION_REPOSITORY,
  TENANT_CONTEXT,
} from './pages.tokens.js';

@Module({
  controllers: [PagesController],
  providers: [
    { provide: DATABASE, useFactory: (): BriskDb => createAppDb() },
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
    { provide: TENANT_CONTEXT, useClass: StaticTenantContextAdapter },
  ],
})
export class PagesModule {}
