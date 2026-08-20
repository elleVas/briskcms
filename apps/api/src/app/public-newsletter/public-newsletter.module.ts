import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { requireEnv } from '@brisk/env-config';
import { TurnstileCaptchaAdapter } from '@brisk/turnstile-captcha';
import { createNewsletterPort } from '../newsletter-port.factory.js';
import { PublicNewsletterController } from './public-newsletter.controller.js';
import { CAPTCHA_PORT, NEWSLETTER_PORT } from './public-newsletter.tokens.js';

@Module({
  imports: [
    // Same throttle as PublicFormsModule — a write endpoint is exactly
    // what a spam bot wants to hit repeatedly.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 10 }] }),
  ],
  controllers: [PublicNewsletterController],
  providers: [
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
  ],
})
export class PublicNewsletterModule {}
