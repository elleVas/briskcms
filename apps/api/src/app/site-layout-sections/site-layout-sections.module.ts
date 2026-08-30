import { Module } from '@nestjs/common';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import {
  DrizzleSiteLayoutSectionRepository,
  DrizzleSiteLayoutSectionVersionRepository,
} from '@brisk/postgres-site-layout-section-repository';
import { PreviewTokenAdapter } from '@brisk/preview-token-adapter';
import { DrizzleSiteRepository } from '@brisk/postgres-site-repository';
import { AuthModule } from '../auth/auth.module';
import { DATABASE, DatabaseModule } from '../database.module';
import { SiteLayoutSectionsController } from './site-layout-sections.controller';
import {
  PREVIEW_TOKEN_PORT,
  SITE_LAYOUT_SECTION_REPOSITORY,
  SITE_LAYOUT_SECTION_VERSION_REPOSITORY,
  SITE_REPOSITORY,
} from './site-layout-sections.tokens';

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
    {
      provide: PREVIEW_TOKEN_PORT,
      useFactory: () =>
        new PreviewTokenAdapter(requireEnv('PREVIEW_TOKEN_SECRET')),
    },
  ],
})
export class SiteLayoutSectionsModule {}
