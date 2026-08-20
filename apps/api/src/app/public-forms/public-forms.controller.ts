import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { getPublicForm, submitForm } from '@brisk/application';
import {
  FormNotFoundError,
  InvalidCaptchaError,
  InvalidFormSubmissionError,
} from '@brisk/domain-core';
import type {
  CaptchaPort,
  EmailPort,
  FormRepositoryPort,
  FormSubmissionRepositoryPort,
} from '@brisk/ports';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import {
  type SubmitFormBody,
  submitFormBodySchema,
} from './public-forms.schemas.js';
import {
  CAPTCHA_PORT,
  DEFAULT_TENANT_ID,
  EMAIL_PORT,
  FORM_REPOSITORY,
  FORM_SUBMISSION_REPOSITORY,
} from './public-forms.tokens.js';

// No SessionAuthGuard — the public, unauthenticated path apps/public-site's
// Form block calls (field definitions live-fetched, docs/adr/0015) and its
// same-origin submission proxy posts through. ThrottlerGuard is stricter
// than PublicPagesController's read traffic (120/60s): a write endpoint is
// the one a spam bot actually wants to hit repeatedly.
@Controller('public/forms')
@UseGuards(ThrottlerGuard)
export class PublicFormsController {
  constructor(
    @Inject(FORM_REPOSITORY)
    private readonly formRepository: FormRepositoryPort,
    @Inject(FORM_SUBMISSION_REPOSITORY)
    private readonly formSubmissionRepository: FormSubmissionRepositoryPort,
    @Inject(EMAIL_PORT) private readonly emailPort: EmailPort,
    @Inject(CAPTCHA_PORT) private readonly captchaPort: CaptchaPort,
    @Inject(DEFAULT_TENANT_ID) private readonly defaultTenantId: string,
  ) {}

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.handleDomainErrors(() =>
      getPublicForm(
        { formRepository: this.formRepository },
        { tenantId: this.defaultTenantId, formId: id },
      ),
    );
  }

  @Post(':id/submissions')
  @HttpCode(204)
  async submit(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(submitFormBodySchema)) body: SubmitFormBody,
  ): Promise<void> {
    return this.handleDomainErrors(() =>
      submitForm(
        {
          formRepository: this.formRepository,
          formSubmissionRepository: this.formSubmissionRepository,
          emailPort: this.emailPort,
          captchaPort: this.captchaPort,
        },
        {
          tenantId: this.defaultTenantId,
          formId: id,
          pageId: body.pageId,
          values: body.values,
          honeypot: body.honeypot,
          captchaToken: body.captchaToken,
        },
      ),
    );
  }

  private async handleDomainErrors<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof FormNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (
        error instanceof InvalidFormSubmissionError ||
        error instanceof InvalidCaptchaError
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
