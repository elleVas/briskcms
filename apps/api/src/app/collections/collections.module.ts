import { Module } from '@nestjs/common';
import { type BriskDb } from '@brisk/postgres-db';
import { DrizzleCollectionRepository } from '@brisk/postgres-page-repository';
import { AuthModule } from '../auth/auth.module';
import { DATABASE, DatabaseModule } from '../database.module';
import { CollectionsController } from './collections.controller';
import { COLLECTION_REPOSITORY } from './collections.tokens';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [CollectionsController],
  providers: [
    {
      provide: COLLECTION_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleCollectionRepository(db),
      inject: [DATABASE],
    },
  ],
})
export class CollectionsModule {}
