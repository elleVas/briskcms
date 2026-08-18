import { describe, expect, it } from 'vitest';
import { buildFormSubmissionNotificationEmail } from './form-submission-notification-email.template.js';

describe('buildFormSubmissionNotificationEmail', () => {
  it('includes the form name and field entries in both bodies', () => {
    const email = buildFormSubmissionNotificationEmail('Contatti', [
      { label: 'Email', value: 'visitor@example.com' },
      { label: 'Note', value: 'Ciao!' },
    ]);

    expect(email.subject).toContain('Contatti');
    expect(email.html).toContain('visitor@example.com');
    expect(email.html).toContain('Ciao!');
    expect(email.text).toContain('visitor@example.com');
    expect(email.text).toContain('Ciao!');
  });

  it('escapes HTML in submitted values to prevent markup injection', () => {
    const email = buildFormSubmissionNotificationEmail('Contatti', [
      { label: 'Note', value: '<img src=x onerror=alert(1)>' },
    ]);

    expect(email.html).not.toContain('<img src=x');
    expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
