import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { requireEnv } from '@brisk/env-config';
import { type BriskDb } from '@brisk/postgres-db';
import {
  DrizzleFormRepository,
  DrizzleFormSubmissionRepository,
} from '@brisk/postgres-form-repository';
import { SmtpEmailAdapter } from '@brisk/smtp-email-adapter';
import { DATABASE, DatabaseModule } from '../database.module.js';
import { PublicFormsController } from './public-forms.controller.js';
import {
  DEFAULT_TENANT_ID,
  EMAIL_PORT,
  FORM_REPOSITORY,
  FORM_SUBMISSION_REPOSITORY,
} from './public-forms.tokens.js';

@Module({
  imports: [
    DatabaseModule,
    // A write endpoint (unlike PublicPagesController's reads) is exactly
    // what a spam bot wants to hit repeatedly — stricter than page-view
    // traffic (120/60s) but more generous than login's 5/60s, since a
    // shared office IP can legitimately submit several different forms.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 10 }] }),
  ],
  controllers: [PublicFormsController],
  providers: [
    // Its own DEFAULT_TENANT_ID/EMAIL_PORT providers rather than importing
    // AuthModule: same reasoning as PublicPagesModule — no business sharing
    // AuthModule's session/throttler wiring just to get the pieces this
    // module actually needs.
    {
      provide: DEFAULT_TENANT_ID,
      useFactory: (): string => requireEnv('DEFAULT_TENANT_ID'),
    },
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
  ],
})
export class PublicFormsModule {}
