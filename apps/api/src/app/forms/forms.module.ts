import { Module } from '@nestjs/common';
import { type BriskDb } from '@brisk/postgres-db';
import { DrizzleFormRepository } from '@brisk/postgres-form-repository';
import { AuthModule } from '../auth/auth.module.js';
import { SessionTenantContextAdapter } from '../auth/session-tenant-context.adapter.js';
import { DATABASE, DatabaseModule } from '../database.module.js';
import { FormsController } from './forms.controller.js';
import { FORM_REPOSITORY, TENANT_CONTEXT } from './forms.tokens.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [FormsController],
  providers: [
    {
      provide: FORM_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleFormRepository(db),
      inject: [DATABASE],
    },
    { provide: TENANT_CONTEXT, useClass: SessionTenantContextAdapter },
  ],
})
export class FormsModule {}
