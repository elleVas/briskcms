import { Module } from '@nestjs/common';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import {
  DrizzleCollectionRepository,
  DrizzlePageGroupRepository,
  DrizzlePageGroupVersionRepository,
  DrizzlePageTranslationRepository,
  DrizzlePageTranslationVersionRepository,
} from '@brisk/postgres-page-repository';
import { PreviewTokenAdapter } from '@brisk/preview-token-adapter';
import { DrizzleReusableSectionRepository } from '@brisk/postgres-reusable-section-repository';
import { DrizzleSearchRepository } from '@brisk/postgres-search-repository';
import { DrizzleSiteRepository } from '@brisk/postgres-site-repository';
import { DrizzleTaxonomyRepository } from '@brisk/postgres-taxonomy-repository';
import { AuthModule } from '../auth/auth.module';
import { DATABASE, DatabaseModule } from '../database.module';
import { PageGroupsController } from './page-groups.controller';
import {
  PREVIEW_TOKEN_PORT,
  REUSABLE_SECTION_REPOSITORY,
  SEARCH_REPOSITORY,
  SITE_REPOSITORY,
  TAXONOMY_REPOSITORY,
  COLLECTION_REPOSITORY,
} from './pages.tokens';
import {
  PAGE_GROUP_REPOSITORY,
  PAGE_GROUP_VERSION_REPOSITORY,
  PAGE_TRANSLATION_REPOSITORY,
  PAGE_TRANSLATION_VERSION_REPOSITORY,
} from './page-groups.tokens';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PageGroupsController],
  providers: [
    {
      // Publishing a page indexes it with its sections expanded — the
      // snapshot holds only the reference (docs/adr/0059).
      provide: REUSABLE_SECTION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleReusableSectionRepository(db),
      inject: [DATABASE],
    },
    {
      // Read-only: checking that a section a page is being filed under
      // actually exists.
      provide: COLLECTION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleCollectionRepository(db),
      inject: [DATABASE],
    },
    {
      // Two jobs, both about addresses (docs/adr/0064): filing a page
      // under terms, and refusing a root page slug a dimension or one of
      // its root-mounted terms already answers.
      provide: TAXONOMY_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleTaxonomyRepository(db),
      inject: [DATABASE],
    },
    {
      // Read-only: which languages the site publishes.
      provide: SITE_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleSiteRepository(db),
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
    {
      provide: PAGE_GROUP_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzlePageGroupRepository(db),
      inject: [DATABASE],
    },
    {
      provide: PAGE_GROUP_VERSION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzlePageGroupVersionRepository(db),
      inject: [DATABASE],
    },
    {
      provide: PAGE_TRANSLATION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzlePageTranslationRepository(db),
      inject: [DATABASE],
    },
    {
      provide: PAGE_TRANSLATION_VERSION_REPOSITORY,
      useFactory: (db: BriskDb) =>
        new DrizzlePageTranslationVersionRepository(db),
      inject: [DATABASE],
    },
  ],
})
export class PagesModule {}
