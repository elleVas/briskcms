import { describe, expect, it } from 'vitest';
import { buildVerificationEmail } from './verification-email.template.js';

describe('buildVerificationEmail', () => {
  it('includes the verification URL in both the HTML and text bodies', () => {
    const url = 'https://editor.example.com/?verifyToken=abc123';

    const email = buildVerificationEmail(url);

    expect(email.html).toContain(url);
    expect(email.text).toContain(url);
    expect(email.subject).toBe('Verifica il tuo indirizzo email');
  });
});
