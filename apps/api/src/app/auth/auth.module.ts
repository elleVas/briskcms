import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import { DrizzleUserRepository } from '@brisk/postgres-user-repository';
import { SessionAuthAdapter } from '@brisk/session-auth-adapter';
import { DATABASE, DatabaseModule } from '../database.module.js';
import { AuthController } from './auth.controller.js';
import {
  AUTH_PORT,
  DEFAULT_TENANT_ID,
  USER_REPOSITORY,
} from './auth.tokens.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import { SessionTenantContextAdapter } from './session-tenant-context.adapter.js';

@Module({
  imports: [
    DatabaseModule,
    // Only applied to POST /auth/login (via @UseGuards(ThrottlerGuard)
    // there) — not registered as a global guard, so the rest of the API is
    // unaffected.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 5 }] }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: DEFAULT_TENANT_ID,
      useFactory: (): string => requireEnv('DEFAULT_TENANT_ID'),
    },
    {
      provide: USER_REPOSITORY,
      useFactory: (db: BriskDb) => new DrizzleUserRepository(db),
      inject: [DATABASE],
    },
    {
      provide: AUTH_PORT,
      useFactory: (db: BriskDb, tenantId: string) =>
        new SessionAuthAdapter(db, tenantId),
      inject: [DATABASE, DEFAULT_TENANT_ID],
    },
    SessionAuthGuard,
    SessionTenantContextAdapter,
  ],
  exports: [
    AUTH_PORT,
    USER_REPOSITORY,
    SessionAuthGuard,
    SessionTenantContextAdapter,
  ],
})
export class AuthModule {}
