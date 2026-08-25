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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { getPublicForm, submitForm } from '@brisk/application';
import {
  FormNotFoundError,
  InvalidCaptchaError,
  InvalidFormSubmissionError,
  UnsupportedAttachmentTypeError,
  sniffAttachmentType,
} from '@brisk/domain-core';
import type {
  AttachmentStoragePort,
  CaptchaPort,
  EmailPort,
  FormRepositoryPort,
  FormSubmissionRepositoryPort,
  NewsletterPort,
} from '@brisk/ports';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import {
  type SubmitFormBody,
  submitFormBodySchema,
} from './public-forms.schemas.js';
import {
  ATTACHMENT_STORAGE,
  CAPTCHA_PORT,
  DEFAULT_TENANT_ID,
  EMAIL_PORT,
  FORM_REPOSITORY,
  FORM_SUBMISSION_REPOSITORY,
  NEWSLETTER_PORT,
} from './public-forms.tokens.js';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // same cap as MediaController's own upload

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
    @Inject(NEWSLETTER_PORT) private readonly newsletterPort: NewsletterPort,
    @Inject(ATTACHMENT_STORAGE)
    private readonly attachmentStorage: AttachmentStoragePort,
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

  // No CAPTCHA re-check here on purpose: a Turnstile token is single-use
  // (a second verify() call with the same token fails), and the final
  // /submissions call below already verifies it once for the whole
  // transaction — this endpoint is protected by ThrottlerGuard only, same
  // as every other write endpoint in this controller. A determined bot
  // could still spam uploads without ever completing a real submission;
  // accepted at this scale (same "not solved further here" trade-off
  // ADR-0015 already made for the second-round-trip live-fetch cost).
  @Post(':id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_ATTACHMENT_BYTES },
    }),
  )
  async uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.handleDomainErrors(async () => {
      const form = await this.formRepository.findById(this.defaultTenantId, id);
      if (!form) {
        throw new FormNotFoundError(id);
      }
      // Unauthenticated endpoint — file.mimetype/originalname are entirely
      // client-controlled, sniff the real bytes instead (security review
      // 2026-08-25).
      const sniffed = sniffAttachmentType(file.buffer, file.mimetype);
      return this.attachmentStorage.upload({
        filename: file.originalname,
        mimeType: sniffed.mimeType,
        extension: sniffed.extension,
        data: file.buffer,
      });
    });
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
          newsletterPort: this.newsletterPort,
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
        error instanceof InvalidCaptchaError ||
        error instanceof UnsupportedAttachmentTypeError
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
