import { BrevoNewsletterAdapter } from '@brisk/brevo-newsletter';
import { MailchimpNewsletterAdapter } from '@brisk/mailchimp-newsletter';
import { NoopNewsletterPort } from '@brisk/ports';
import { createNewsletterPort } from './newsletter-port.factory.js';

// Same "test the branch in isolation" reasoning as media.module.spec.ts's
// createMediaStorage tests.
describe('createNewsletterPort', () => {
  const ENV_KEYS = [
    'NEWSLETTER_PROVIDER',
    'MAILCHIMP_API_KEY',
    'MAILCHIMP_AUDIENCE_ID',
    'BREVO_API_KEY',
    'BREVO_LIST_ID',
  ] as const;
  const originalValues = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const original = originalValues[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  });

  it('defaults to a no-op when NEWSLETTER_PROVIDER is unset', () => {
    delete process.env['NEWSLETTER_PROVIDER'];

    expect(createNewsletterPort()).toBeInstanceOf(NoopNewsletterPort);
  });

  it('builds a MailchimpNewsletterAdapter when NEWSLETTER_PROVIDER=mailchimp', () => {
    process.env['NEWSLETTER_PROVIDER'] = 'mailchimp';
    process.env['MAILCHIMP_API_KEY'] = 'test-key-us1';
    process.env['MAILCHIMP_AUDIENCE_ID'] = 'audience-1';

    expect(createNewsletterPort()).toBeInstanceOf(MailchimpNewsletterAdapter);
  });

  it('fails fast when a required Mailchimp variable is missing', () => {
    process.env['NEWSLETTER_PROVIDER'] = 'mailchimp';
    delete process.env['MAILCHIMP_API_KEY'];

    expect(() => createNewsletterPort()).toThrow(
      /Missing required environment variable: MAILCHIMP_API_KEY/,
    );
  });

  it('builds a BrevoNewsletterAdapter when NEWSLETTER_PROVIDER=brevo', () => {
    process.env['NEWSLETTER_PROVIDER'] = 'brevo';
    process.env['BREVO_API_KEY'] = 'test-key';
    process.env['BREVO_LIST_ID'] = '7';

    expect(createNewsletterPort()).toBeInstanceOf(BrevoNewsletterAdapter);
  });

  it('fails fast when a required Brevo variable is missing', () => {
    process.env['NEWSLETTER_PROVIDER'] = 'brevo';
    delete process.env['BREVO_API_KEY'];

    expect(() => createNewsletterPort()).toThrow(
      /Missing required environment variable: BREVO_API_KEY/,
    );
  });
});
