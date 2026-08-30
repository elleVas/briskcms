import { Module } from '@nestjs/common';
import { type BriskDb } from '@brisk/postgres-db';
import { DrizzleFormRepository } from '@brisk/postgres-form-repository';
import { AuthModule } from '../auth/auth.module';
import { DATABASE, DatabaseModule } from '../database.module';
import { FormsController } from './forms.controller';
import { FORM_REPOSITORY } from './forms.tokens';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [FormsController],
  providers: [
    {
      provide: FORM_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleFormRepository(db),
      inject: [DATABASE],
    },
  ],
})
export class FormsModule {}
