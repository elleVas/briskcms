import { Module } from '@nestjs/common';
import { type BriskDb } from '@brisk/postgres-db';
import { DrizzleCollectionRepository } from '@brisk/postgres-page-repository';
import { DrizzleReusableSectionRepository } from '@brisk/postgres-reusable-section-repository';
import { AuthModule } from '../auth/auth.module';
import { DATABASE, DatabaseModule } from '../database.module';
import { CollectionsController } from './collections.controller';
import {
  COLLECTION_REPOSITORY,
  REUSABLE_SECTION_REPOSITORY,
} from './collections.tokens';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [CollectionsController],
  providers: [
    {
      provide: COLLECTION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleCollectionRepository(db),
      inject: [DATABASE],
    },
    {
      // Read-only: checking that a default template is one a page of the
      // site can start from (docs/adr/0072).
      provide: REUSABLE_SECTION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleReusableSectionRepository(db),
      inject: [DATABASE],
    },
  ],
})
export class CollectionsModule {}
