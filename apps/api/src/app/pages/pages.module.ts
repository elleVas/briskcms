import { Module } from '@nestjs/common';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import {
  DrizzlePageGroupRepository,
  DrizzlePageGroupVersionRepository,
  DrizzlePageTranslationRepository,
  DrizzlePageTranslationVersionRepository,
} from '@brisk/postgres-page-repository';
import { PreviewTokenAdapter } from '@brisk/preview-token-adapter';
import { DrizzleSearchRepository } from '@brisk/postgres-search-repository';
import { AuthModule } from '../auth/auth.module';
import { DATABASE, DatabaseModule } from '../database.module';
import { PageGroupsController } from './page-groups.controller';
import { PREVIEW_TOKEN_PORT, SEARCH_REPOSITORY } from './pages.tokens';
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
