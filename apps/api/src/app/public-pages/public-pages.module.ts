import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import {
  DrizzlePageGroupRepository,
  DrizzlePageTranslationRepository,
} from '@brisk/postgres-page-repository';
import { PreviewTokenAdapter } from '@brisk/preview-token-adapter';
import { DrizzleSearchRepository } from '@brisk/postgres-search-repository';
import { DrizzleSiteLayoutSectionRepository } from '@brisk/postgres-site-layout-section-repository';
import {
  DrizzleSiteRepository,
  DrizzleSiteThemeBlockStylesRepository,
} from '@brisk/postgres-site-repository';
import { DATABASE, DatabaseModule } from '../database.module';
import { PublicPagesController } from './public-pages.controller';
import {
  DEFAULT_TENANT_ID,
  PAGE_GROUP_REPOSITORY,
  PAGE_TRANSLATION_REPOSITORY,
  PREVIEW_TOKEN_PORT,
  SEARCH_REPOSITORY,
  SITE_LAYOUT_SECTION_REPOSITORY,
  SITE_REPOSITORY,
  SITE_THEME_BLOCK_STYLES_REPOSITORY,
} from './public-pages.tokens';

@Module({
  imports: [
    DatabaseModule,
    // Generous limit tuned for real page-view traffic, not login-attempt
    // strictness (compare AuthModule's throttler) — this endpoint is hit on
    // every public page load, not just a rare auth action. A separate
    // ThrottlerModule instance, not a shared one with AuthModule, so
    // changing one limit can never accidentally change the other.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 120 }] }),
  ],
  controllers: [PublicPagesController],
  providers: [
    // Its own DEFAULT_TENANT_ID provider rather than importing AuthModule
    // for the one it already has: AuthModule also wires SMTP/email/session
    // providers this module has no business depending on to boot.
    {
      provide: DEFAULT_TENANT_ID,
      useFactory: (): string => requireEnv('DEFAULT_TENANT_ID'),
    },
    {
      provide: PAGE_GROUP_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzlePageGroupRepository(db),
      inject: [DATABASE],
    },
    {
      provide: PAGE_TRANSLATION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzlePageTranslationRepository(db),
      inject: [DATABASE],
    },
    {
      provide: SITE_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleSiteRepository(db),
      inject: [DATABASE],
    },
    {
      provide: SITE_LAYOUT_SECTION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleSiteLayoutSectionRepository(db),
      inject: [DATABASE],
    },
    {
      provide: SITE_THEME_BLOCK_STYLES_REPOSITORY,
      useFactory: (db: BriskDb) =>
        new DrizzleSiteThemeBlockStylesRepository(db),
      inject: [DATABASE],
    },
    {
      provide: SEARCH_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleSearchRepository(db),
      inject: [DATABASE],
    },
    {
      provide: PREVIEW_TOKEN_PORT,
      useFactory: () =>
        new PreviewTokenAdapter(requireEnv('PREVIEW_TOKEN_SECRET')),
    },
  ],
})
export class PublicPagesModule {}
