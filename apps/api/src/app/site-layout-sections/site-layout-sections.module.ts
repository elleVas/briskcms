import { Module } from '@nestjs/common';
import { type BriskDb } from '@brisk/postgres-db';
import {
  DrizzleSiteLayoutSectionRepository,
  DrizzleSiteLayoutSectionVersionRepository,
} from '@brisk/postgres-site-layout-section-repository';
import { DrizzleSiteRepository } from '@brisk/postgres-site-repository';
import { AuthModule } from '../auth/auth.module.js';
import { SessionTenantContextAdapter } from '../auth/session-tenant-context.adapter.js';
import { DATABASE, DatabaseModule } from '../database.module.js';
import { SiteLayoutSectionsController } from './site-layout-sections.controller.js';
import {
  SITE_LAYOUT_SECTION_REPOSITORY,
  SITE_LAYOUT_SECTION_VERSION_REPOSITORY,
  SITE_REPOSITORY,
  TENANT_CONTEXT,
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
    { provide: TENANT_CONTEXT, useClass: SessionTenantContextAdapter },
  ],
})
export class SiteLayoutSectionsModule {}
