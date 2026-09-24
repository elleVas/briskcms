import { Module } from '@nestjs/common';
import { type BriskDb } from '@brisk/postgres-db';
import {
  DrizzleFormRepository,
  DrizzleFormSubmissionRepository,
} from '@brisk/postgres-form-repository';
import { DrizzlePageTranslationRepository } from '@brisk/postgres-page-repository';
import { AuthModule } from '../auth/auth.module';
import { DATABASE, DatabaseModule } from '../database.module';
import { FormsController } from './forms.controller';
import {
  FORM_REPOSITORY,
  FORM_SUBMISSION_REPOSITORY,
  PAGE_TRANSLATION_REPOSITORY,
} from './forms.tokens';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [FormsController],
  providers: [
    {
      provide: FORM_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleFormRepository(db),
      inject: [DATABASE],
    },
    {
      provide: FORM_SUBMISSION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleFormSubmissionRepository(db),
      inject: [DATABASE],
    },
    {
      // Read-only here, and for one question: what is the page a
      // submission came from called (listFormSubmissions' pages)?
      provide: PAGE_TRANSLATION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzlePageTranslationRepository(db),
      inject: [DATABASE],
    },
  ],
})
export class FormsModule {}
