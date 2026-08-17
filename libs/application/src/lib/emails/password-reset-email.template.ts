import type { EmailMessage } from '@brisk/ports';
import { ctaButtonHtml, renderEmailLayout } from './email-layout.js';

export function buildPasswordResetEmail(
  resetUrl: string,
): Omit<EmailMessage, 'to'> {
  const subject = 'Reimposta la tua password';
  const html = renderEmailLayout(
    `<p style="margin:0 0 16px;color:#374151;font-size:14px;">Abbiamo ricevuto una richiesta di reimpostazione della password per il tuo account Brisk.</p>
     ${ctaButtonHtml(resetUrl, 'Reimposta la password')}
     <p style="margin-top:16px;color:#6b7280;font-size:12px;">Il link scade tra 1 ora. Reimpostando la password verranno terminate tutte le sessioni attive.</p>`,
  );
  const text = `Abbiamo ricevuto una richiesta di reimpostazione della password per il tuo account Brisk.\n\n${resetUrl}\n\nIl link scade tra 1 ora. Reimpostando la password verranno terminate tutte le sessioni attive.`;

  return { subject, html, text };
}
