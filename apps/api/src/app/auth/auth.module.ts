import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import { DrizzleUserRepository } from '@brisk/postgres-user-repository';
import { SessionAuthAdapter } from '@brisk/session-auth-adapter';
import { VerificationTokenAdapter } from '@brisk/verification-token-adapter';
import { SmtpEmailAdapter } from '@brisk/smtp-email-adapter';
import { TurnstileCaptchaAdapter } from '@brisk/turnstile-captcha';
import { DATABASE, DatabaseModule } from '../database.module.js';
import { AuthController } from './auth.controller.js';
import {
  AUTH_PORT,
  CAPTCHA_PORT,
  DEFAULT_TENANT_ID,
  EDITOR_APP_URL,
  EMAIL_PORT,
  USER_REPOSITORY,
  VERIFICATION_TOKEN_PORT,
} from './auth.tokens.js';
import { PerAccountThrottlerGuard } from './per-account-throttler.guard.js';
import { RolesGuard } from './roles.guard.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import { SessionTenantContextAdapter } from './session-tenant-context.adapter.js';

@Module({
  imports: [
    DatabaseModule,
    // Only applied to specific routes (via @UseGuards(ThrottlerGuard))
    // — not registered as a global guard, so the rest of the API is
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
      provide: EDITOR_APP_URL,
      useFactory: (): string => requireEnv('EDITOR_APP_URL'),
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
    {
      provide: VERIFICATION_TOKEN_PORT,
      useFactory: (db: BriskDb, tenantId: string) =>
        new VerificationTokenAdapter(db, tenantId),
      inject: [DATABASE, DEFAULT_TENANT_ID],
    },
    {
      provide: EMAIL_PORT,
      // SMTP_USER/SMTP_PASSWORD are optional — Mailpit (local dev) needs
      // neither, see docs/development.md.
      useFactory: () =>
        new SmtpEmailAdapter({
          host: requireEnv('SMTP_HOST'),
          port: Number(requireEnv('SMTP_PORT')),
          fromAddress: requireEnv('SMTP_FROM_ADDRESS'),
          user: process.env['SMTP_USER'] || undefined,
          password: process.env['SMTP_PASSWORD'] || undefined,
        }),
    },
    {
      provide: CAPTCHA_PORT,
      useFactory: () =>
        new TurnstileCaptchaAdapter({
          secretKey: requireEnv('TURNSTILE_SECRET_KEY'),
        }),
    },
    SessionAuthGuard,
    RolesGuard,
    PerAccountThrottlerGuard,
    SessionTenantContextAdapter,
  ],
  exports: [
    AUTH_PORT,
    USER_REPOSITORY,
    VERIFICATION_TOKEN_PORT,
    EMAIL_PORT,
    EDITOR_APP_URL,
    SessionAuthGuard,
    RolesGuard,
    SessionTenantContextAdapter,
  ],
})
export class AuthModule {}
