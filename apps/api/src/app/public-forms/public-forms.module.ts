import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import {
  DrizzleFormRepository,
  DrizzleFormSubmissionRepository,
} from '@brisk/postgres-form-repository';
import { SmtpEmailAdapter } from '@brisk/smtp-email-adapter';
import { TurnstileCaptchaAdapter } from '@brisk/turnstile-captcha';
import { DATABASE, DatabaseModule } from '../database.module';
import { DeploymentTenantModule } from '../deployment-tenant.module';
import { createAttachmentStorage } from '../attachment-storage.factory';
import { createNewsletterPort } from '../newsletter-port.factory';
import { PublicFormsController } from './public-forms.controller';
import {
  ATTACHMENT_STORAGE,
  CAPTCHA_PORT,
  EMAIL_PORT,
  FORM_REPOSITORY,
  FORM_SUBMISSION_REPOSITORY,
  NEWSLETTER_PORT,
} from './public-forms.tokens';

@Module({
  imports: [
    DeploymentTenantModule,
    DatabaseModule,
    // A write endpoint (unlike PublicPagesController's reads) is exactly
    // what a spam bot wants to hit repeatedly — stricter than page-view
    // traffic (120/60s) but more generous than login's 5/60s, since a
    // shared office IP can legitimately submit several different forms.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 10 }] }),
  ],
  controllers: [PublicFormsController],
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
    {
      provide: NEWSLETTER_PORT,
      useFactory: createNewsletterPort,
    },
    {
      provide: ATTACHMENT_STORAGE,
      useFactory: createAttachmentStorage,
    },
  ],
})
export class PublicFormsModule {}
