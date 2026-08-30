import { Module } from '@nestjs/common';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import {
  DrizzlePageRepository,
  DrizzlePageVersionRepository,
} from '@brisk/postgres-page-repository';
import { PreviewTokenAdapter } from '@brisk/preview-token-adapter';
import { DrizzleSearchRepository } from '@brisk/postgres-search-repository';
import { AuthModule } from '../auth/auth.module';
import { DATABASE, DatabaseModule } from '../database.module';
import { PagesController } from './pages.controller';
import {
  PAGE_REPOSITORY,
  PAGE_VERSION_REPOSITORY,
  PREVIEW_TOKEN_PORT,
  SEARCH_REPOSITORY,
} from './pages.tokens';

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
    {
      provide: PREVIEW_TOKEN_PORT,
      useFactory: () =>
        new PreviewTokenAdapter(requireEnv('PREVIEW_TOKEN_SECRET')),
    },
  ],
})
export class PagesModule {}
