import { randomUUID } from 'node:crypto';
import {
  FormNotFoundError,
  FormSubmission,
  InvalidCaptchaError,
  InvalidFormSubmissionError,
} from '@brisk/domain-core';
import type { FormField } from '@brisk/shared-types';
import type {
  CaptchaPort,
  EmailPort,
  FormRepositoryPort,
  FormSubmissionRepositoryPort,
} from '@brisk/ports';
import { buildFormSubmissionNotificationEmail } from '../emails/form-submission-notification-email.template.js';

export interface SubmitFormDeps {
  formRepository: FormRepositoryPort;
  formSubmissionRepository: FormSubmissionRepositoryPort;
  emailPort: EmailPort;
  captchaPort: CaptchaPort;
}

export interface SubmitFormInput {
  tenantId: string;
  formId: string;
  pageId: string | null;
  values: Record<string, unknown>;
  /** CSS-hidden field real visitors never fill (docs/adr/0015). Non-empty means a bot. */
  honeypot: string;
  /** Cloudflare Turnstile's client-side widget token. */
  captchaToken: string;
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function validateValues(
  fields: FormField[],
  values: Record<string, unknown>,
): void {
  for (const field of fields) {
    if (!field.required) {
      continue;
    }
    const value = values[field.id];
    const missing = field.type === 'checkbox' ? value !== true : isBlank(value);
    if (missing) {
      throw new InvalidFormSubmissionError(
        `Missing required field: ${field.label}`,
      );
    }
  }
}

function formatValue(field: FormField, value: unknown): string {
  if (field.type === 'checkbox') {
    return value === true ? 'Sì' : 'No';
  }
  return isBlank(value) ? '—' : String(value);
}

export async function submitForm(
  deps: SubmitFormDeps,
  input: SubmitFormInput,
): Promise<void> {
  const form = await deps.formRepository.findById(input.tenantId, input.formId);
  if (!form) {
    throw new FormNotFoundError(input.formId);
  }

  if (input.honeypot.trim() !== '') {
    // Silent accept: the caller gets the same "success" response a real
    // submission would, so a bot can never distinguish "rejected" from
    // "accepted" and tune itself against this check. Checked before the
    // CAPTCHA verify call below so a caught bot never even burns a
    // Turnstile API round-trip.
    return;
  }

  const captchaValid = await deps.captchaPort.verify({
    token: input.captchaToken,
  });
  if (!captchaValid) {
    // Visible failure, unlike the honeypot above: a real visitor can hit
    // this from an expired/blocked token and deserves a chance to retry,
    // not a fake success.
    throw new InvalidCaptchaError();
  }

  validateValues(form.fields, input.values);

  const submission = FormSubmission.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    siteId: form.siteId,
    pageId: input.pageId,
    formId: form.id,
    payload: input.values,
  });
  await deps.formSubmissionRepository.save(submission);

  if (form.notificationEmail) {
    const entries = form.fields.map((field) => ({
      label: field.label,
      value: formatValue(field, input.values[field.id]),
    }));
    await deps.emailPort.sendEmail({
      to: form.notificationEmail,
      ...buildFormSubmissionNotificationEmail(form.name, entries),
    });
  }
}
