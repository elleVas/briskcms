import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SessionTenantContextAdapter } from '../auth/session-tenant-context.adapter.js';
import { UsersController } from './users.controller.js';
import { TENANT_CONTEXT } from './users.tokens.js';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [
    { provide: TENANT_CONTEXT, useClass: SessionTenantContextAdapter },
  ],
})
export class UsersModule {}
