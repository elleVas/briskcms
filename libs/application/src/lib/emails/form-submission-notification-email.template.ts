import type { EmailMessage } from '@brisk/ports';
import { escapeHtml, renderEmailLayout } from './email-layout.js';

export interface FormSubmissionEntry {
  label: string;
  value: string;
}

export function buildFormSubmissionNotificationEmail(
  formName: string,
  entries: FormSubmissionEntry[],
): Omit<EmailMessage, 'to'> {
  const subject = `Nuova risposta al modulo "${formName}"`;
  const rowsHtml = entries
    .map(
      (entry) =>
        `<p style="margin:0 0 12px;color:#374151;font-size:14px;"><strong>${escapeHtml(entry.label)}:</strong> ${escapeHtml(entry.value)}</p>`,
    )
    .join('');
  const html = renderEmailLayout(
    `<p style="margin:0 0 16px;color:#374151;font-size:14px;">Hai ricevuto una nuova risposta al modulo <strong>${escapeHtml(formName)}</strong>.</p>
     ${rowsHtml}`,
  );
  const text = `Hai ricevuto una nuova risposta al modulo "${formName}".\n\n${entries.map((entry) => `${entry.label}: ${entry.value}`).join('\n')}`;

  return { subject, html, text };
}
