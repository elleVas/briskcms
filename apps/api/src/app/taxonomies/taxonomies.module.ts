import { Module } from '@nestjs/common';
import { type BriskDb } from '@brisk/postgres-db';
import { DrizzleTaxonomyRepository } from '@brisk/postgres-taxonomy-repository';
import { DrizzlePageTranslationRepository } from '@brisk/postgres-page-repository';
import { DrizzleSiteRepository } from '@brisk/postgres-site-repository';
import { AuthModule } from '../auth/auth.module';
import { DATABASE, DatabaseModule } from '../database.module';
import { TaxonomiesController } from './taxonomies.controller';
import {
  PAGE_TRANSLATION_REPOSITORY,
  SITE_REPOSITORY,
  TAXONOMY_REPOSITORY,
} from './taxonomies.tokens';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [TaxonomiesController],
  providers: [
    {
      provide: TAXONOMY_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleTaxonomyRepository(db),
      inject: [DATABASE],
    },
    {
      // Read-only here: asking whether a page already answers at an
      // address a taxonomy or a term wants (docs/adr/0064).
      provide: PAGE_TRANSLATION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzlePageTranslationRepository(db),
      inject: [DATABASE],
    },
    {
      // Read-only: a prefix has to be free in every language the site
      // publishes, and the site is what knows which those are.
      provide: SITE_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleSiteRepository(db),
      inject: [DATABASE],
    },
  ],
})
export class TaxonomiesModule {}
