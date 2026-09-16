import type { EmailMessage, EmailPort } from '@brisk/ports';

/** Records sent emails in-memory instead of actually delivering them. */
export class FakeEmailPort implements EmailPort {
  readonly sentEmails: EmailMessage[] = [];

  async sendEmail(message: EmailMessage): Promise<void> {
    this.sentEmails.push(message);
  }
}
