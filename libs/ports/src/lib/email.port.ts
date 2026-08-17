export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Implemented by @brisk/smtp-email-adapter — generic SMTP, no vendor lock-in. */
export interface EmailPort {
  sendEmail(message: EmailMessage): Promise<void>;
}
