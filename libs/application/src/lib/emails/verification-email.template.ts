import type { EmailMessage } from '@brisk/ports';
import { ctaButtonHtml, renderEmailLayout } from './email-layout.js';

export function buildVerificationEmail(
  verifyUrl: string,
): Omit<EmailMessage, 'to'> {
  const subject = 'Verifica il tuo indirizzo email';
  const html = renderEmailLayout(
    `<p style="margin:0 0 16px;color:#374151;font-size:14px;">Conferma il tuo indirizzo email per completare la configurazione del tuo account Brisk.</p>
     ${ctaButtonHtml(verifyUrl, 'Verifica la tua email')}
     <p style="margin-top:16px;color:#6b7280;font-size:12px;">Il link scade tra 24 ore.</p>`,
  );
  const text = `Conferma il tuo indirizzo email per completare la configurazione del tuo account Brisk.\n\n${verifyUrl}\n\nIl link scade tra 24 ore.`;

  return { subject, html, text };
}
