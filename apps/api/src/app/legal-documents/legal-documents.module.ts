import { Module } from '@nestjs/common';
import { type BriskDb } from '@brisk/postgres-db';
import { DrizzleSiteRepository } from '@brisk/postgres-site-repository';
import {
  DrizzlePageGroupRepository,
  DrizzlePageTranslationRepository,
} from '@brisk/postgres-page-repository';
import { AuthModule } from '../auth/auth.module';
import { DATABASE, DatabaseModule } from '../database.module';
import {
  PAGE_GROUP_REPOSITORY,
  PAGE_TRANSLATION_REPOSITORY,
} from '../pages/page-groups.tokens';
import { SITE_REPOSITORY } from '../sites/sites.tokens';
import { LegalDocumentsController } from './legal-documents.controller';

// Same "every module re-provides its own repos via useFactory" pattern as
// PagesModule/SitesModule (no shared-provider exports in this codebase) —
// this module needs Site (for defaultLocale/enabledLocales/BusinessInfo-
// derived answers) AND PageGroup/PageTranslation (to create the drafts),
// so it provides all three independently rather than importing SitesModule/
// PagesModule wholesale.
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [LegalDocumentsController],
  providers: [
    {
      provide: SITE_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleSiteRepository(db),
      inject: [DATABASE],
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
  ],
})
export class LegalDocumentsModule {}
