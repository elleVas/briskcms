import { describe, expect, it } from 'vitest';
import { buildPasswordResetEmail } from './password-reset-email.template';

describe('buildPasswordResetEmail', () => {
  it('includes the reset URL in both the HTML and text bodies', () => {
    const url = 'https://editor.example.com/?resetToken=abc123';

    const email = buildPasswordResetEmail(url);

    expect(email.html).toContain(url);
    expect(email.text).toContain(url);
    expect(email.subject).toBe('Reimposta la tua password');
  });
});
