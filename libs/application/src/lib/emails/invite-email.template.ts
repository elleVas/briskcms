import type { EmailMessage } from '@brisk/ports';
import { ctaButtonHtml, renderEmailLayout } from './email-layout.js';

export function buildInviteEmail(inviteUrl: string): Omit<EmailMessage, 'to'> {
  const subject = 'Sei stato invitato su Brisk';
  const html = renderEmailLayout(
    `<p style="margin:0 0 16px;color:#374151;font-size:14px;">Un amministratore ti ha invitato a collaborare su Brisk. Imposta la tua password per accedere.</p>
     ${ctaButtonHtml(inviteUrl, "Accetta l'invito")}
     <p style="margin-top:16px;color:#6b7280;font-size:12px;">Il link scade tra 7 giorni.</p>`,
  );
  const text = `Un amministratore ti ha invitato a collaborare su Brisk.\n\n${inviteUrl}\n\nIl link scade tra 7 giorni.`;

  return { subject, html, text };
}
