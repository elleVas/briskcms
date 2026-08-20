import { requireEnv } from '@brisk/env-config';
import { BrevoNewsletterAdapter } from '@brisk/brevo-newsletter';
import { MailchimpNewsletterAdapter } from '@brisk/mailchimp-newsletter';
import { NoopNewsletterPort, type NewsletterPort } from '@brisk/ports';

/**
 * No-op unless NEWSLETTER_PROVIDER is explicitly set — newsletter is an
 * optional feature (unlike SMTP/CAPTCHA), so every deployment that never
 * sets it must keep booting exactly as before, same reasoning as
 * MediaModule's createMediaStorage default. Provider-specific variables
 * are only required (requireEnv, fail loud) once that provider has
 * actually been opted into. Shared between PublicFormsModule (the
 * newsletter-consent checkbox on an existing form) and
 * PublicNewsletterModule (the standalone NewsletterSignup block) — both
 * need the identical provider selected, not two copies of this logic.
 */
export function createNewsletterPort(): NewsletterPort {
  const provider = process.env['NEWSLETTER_PROVIDER'];

  if (provider === 'mailchimp') {
    return new MailchimpNewsletterAdapter({
      apiKey: requireEnv('MAILCHIMP_API_KEY'),
      audienceId: requireEnv('MAILCHIMP_AUDIENCE_ID'),
    });
  }

  if (provider === 'brevo') {
    return new BrevoNewsletterAdapter({
      apiKey: requireEnv('BREVO_API_KEY'),
      listId: Number(requireEnv('BREVO_LIST_ID')),
    });
  }

  return new NoopNewsletterPort();
}
