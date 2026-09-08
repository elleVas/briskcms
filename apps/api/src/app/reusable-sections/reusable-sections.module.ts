import { Module } from '@nestjs/common';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import {
  DrizzleReusableSectionRepository,
  DrizzleReusableSectionVersionRepository,
} from '@brisk/postgres-reusable-section-repository';
import {
  DrizzlePageGroupRepository,
  DrizzlePageTranslationRepository,
} from '@brisk/postgres-page-repository';
import { DrizzleSearchRepository } from '@brisk/postgres-search-repository';
import { PreviewTokenAdapter } from '@brisk/preview-token-adapter';
import { AuthModule } from '../auth/auth.module';
import { DATABASE, DatabaseModule } from '../database.module';
import { ReusableSectionsController } from './reusable-sections.controller';
import {
  PAGE_GROUP_REPOSITORY,
  PAGE_TRANSLATION_REPOSITORY,
  PREVIEW_TOKEN_PORT,
  REUSABLE_SECTION_REPOSITORY,
  REUSABLE_SECTION_VERSION_REPOSITORY,
  SEARCH_PORT,
} from './reusable-sections.tokens';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ReusableSectionsController],
  providers: [
    {
      provide: REUSABLE_SECTION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleReusableSectionRepository(db),
      inject: [DATABASE],
    },
    {
      provide: REUSABLE_SECTION_VERSION_REPOSITORY,
      useFactory: (db: BriskDb) =>
        new DrizzleReusableSectionVersionRepository(db),
      inject: [DATABASE],
    },
    // Publishing a section re-indexes the pages that use it — see
    // publishReusableSection for why that is part of publishing and not
    // housekeeping.
    {
      provide: PAGE_TRANSLATION_REPOSITORY,
      // Read-only here (finding the pages a section appears on), so no
      // version repository: this module never writes a translation.
      useFactory: (db: BriskDb) => new DrizzlePageTranslationRepository(db),
      inject: [DATABASE],
    },
    {
      // Read-only: counting the pages a section is placed on.
      provide: PAGE_GROUP_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzlePageGroupRepository(db),
      inject: [DATABASE],
    },
    {
      provide: SEARCH_PORT,
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
export class ReusableSectionsModule {}
