import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import { DrizzleUserRepository } from '@brisk/postgres-user-repository';
import { SessionAuthAdapter } from '@brisk/session-auth-adapter';
import { VerificationTokenAdapter } from '@brisk/verification-token-adapter';
import { SmtpEmailAdapter } from '@brisk/smtp-email-adapter';
import { TurnstileCaptchaAdapter } from '@brisk/turnstile-captcha';
import { DATABASE, DatabaseModule } from '../database.module';
import {
  DEPLOYMENT_TENANT_RESOLVER,
  DeploymentTenantResolver,
} from '../deployment-tenant.resolver';
import { DeploymentTenantModule } from '../deployment-tenant.module';
import { AuthController } from './auth.controller';
import {
  AUTH_PORT,
  CAPTCHA_PORT,
  EDITOR_APP_URL,
  EMAIL_PORT,
  TENANT_CONTEXT,
  USER_REPOSITORY,
  VERIFICATION_TOKEN_PORT,
} from './auth.tokens';
import { PerAccountThrottlerGuard } from './per-account-throttler.guard';
import { RolesGuard } from './roles.guard';
import { SessionAuthGuard } from './session-auth.guard';
import { SessionTenantContextAdapter } from './session-tenant-context.adapter';

@Module({
  imports: [
    DeploymentTenantModule,
    DatabaseModule,
    // Only applied to specific routes (via @UseGuards(ThrottlerGuard))
    // — not registered as a global guard, so the rest of the API is
    // unaffected.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 5 }] }),
  ],
  controllers: [AuthController],
  providers: [
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
      useFactory: (db: BriskDb, tenant: DeploymentTenantResolver) =>
        new SessionAuthAdapter(db, () => tenant.require()),
      inject: [DATABASE, DEPLOYMENT_TENANT_RESOLVER],
    },
    {
      provide: VERIFICATION_TOKEN_PORT,
      useFactory: (db: BriskDb, tenant: DeploymentTenantResolver) =>
        new VerificationTokenAdapter(db, () => tenant.require()),
      inject: [DATABASE, DEPLOYMENT_TENANT_RESOLVER],
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
    { provide: TENANT_CONTEXT, useClass: SessionTenantContextAdapter },
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
    TENANT_CONTEXT,
  ],
})
export class AuthModule {}
