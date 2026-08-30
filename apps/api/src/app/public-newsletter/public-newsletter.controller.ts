import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { subscribeNewsletter } from '@brisk/application';
import { InvalidCaptchaError } from '@brisk/domain-core';
import type { CaptchaPort, NewsletterPort } from '@brisk/ports';
import { ZodValidationPipe } from '../zod-validation.pipe';
import {
  type SubscribeNewsletterBody,
  subscribeNewsletterBodySchema,
} from './public-newsletter.schemas';
import { CAPTCHA_PORT, NEWSLETTER_PORT } from './public-newsletter.tokens';

// Same reasoning as PublicFormsController: no SessionAuthGuard (the public,
// unauthenticated path apps/public-site's NewsletterSignup block posts
// through via its own same-origin proxy), ThrottlerGuard tuned for a write
// endpoint a spam bot actually wants to hit repeatedly.
@Controller('public/newsletter')
@UseGuards(ThrottlerGuard)
export class PublicNewsletterController {
  constructor(
    @Inject(CAPTCHA_PORT) private readonly captchaPort: CaptchaPort,
    @Inject(NEWSLETTER_PORT) private readonly newsletterPort: NewsletterPort,
  ) {}

  @Post('subscribe')
  @HttpCode(204)
  async subscribe(
    @Body(new ZodValidationPipe(subscribeNewsletterBodySchema))
    body: SubscribeNewsletterBody,
  ): Promise<void> {
    try {
      await subscribeNewsletter(
        { captchaPort: this.captchaPort, newsletterPort: this.newsletterPort },
        {
          email: body.email,
          honeypot: body.honeypot,
          captchaToken: body.captchaToken,
        },
      );
    } catch (error) {
      if (error instanceof InvalidCaptchaError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
