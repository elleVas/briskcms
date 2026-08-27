import { Module } from '@nestjs/common';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import {
  DrizzleSiteLayoutSectionRepository,
  DrizzleSiteLayoutSectionVersionRepository,
} from '@brisk/postgres-site-layout-section-repository';
import { PreviewTokenAdapter } from '@brisk/preview-token-adapter';
import { DrizzleSiteRepository } from '@brisk/postgres-site-repository';
import { AuthModule } from '../auth/auth.module.js';
import { DATABASE, DatabaseModule } from '../database.module.js';
import { SiteLayoutSectionsController } from './site-layout-sections.controller.js';
import {
  DEFAULT_TENANT_ID,
  PREVIEW_TOKEN_PORT,
  SITE_LAYOUT_SECTION_REPOSITORY,
  SITE_LAYOUT_SECTION_VERSION_REPOSITORY,
  SITE_REPOSITORY,
} from './site-layout-sections.tokens.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SiteLayoutSectionsController],
  providers: [
    {
      provide: SITE_LAYOUT_SECTION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleSiteLayoutSectionRepository(db),
      inject: [DATABASE],
    },
    {
      provide: SITE_LAYOUT_SECTION_VERSION_REPOSITORY,
      useFactory: (db: BriskDb) =>
        new DrizzleSiteLayoutSectionVersionRepository(db),
      inject: [DATABASE],
    },
    {
      provide: SITE_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleSiteRepository(db),
      inject: [DATABASE],
    },
    // Locale a questo modulo, non importato da AuthModule (che non lo
    // esporta) — stessa scelta di public-pages.module.ts/pages.module.ts.
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
export class SiteLayoutSectionsModule {}
