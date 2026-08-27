import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PROMO_BAR_DISMISS_SCRIPT } from '../components/blocks/promo-bar-dismiss-script.js';
import { buildContentSecurityPolicy } from './content-security-policy.js';

describe('buildContentSecurityPolicy', () => {
  it('includes the exact hash of the promo bar dismiss script', () => {
    const expectedHash = createHash('sha256')
      .update(PROMO_BAR_DISMISS_SCRIPT)
      .digest('base64');

    expect(buildContentSecurityPolicy(`'self'`)).toContain(
      `'sha256-${expectedHash}'`,
    );
  });

  it('sets the given value as frame-ancestors, nothing else', () => {
    const policy = buildContentSecurityPolicy('http://localhost:4200');

    expect(policy).toContain('frame-ancestors http://localhost:4200');
    expect(policy).not.toContain(`frame-ancestors 'self'`);
  });

  it('never allows unsafe-inline or unsafe-eval for scripts', () => {
    const policy = buildContentSecurityPolicy(`'self'`);
    const scriptSrc = policy
      .split(';')
      .find((directive) => directive.trim().startsWith('script-src'));

    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');
  });

  it('allows the exact iframe origins VideoEmbed/MapEmbed/Turnstile need', () => {
    const policy = buildContentSecurityPolicy(`'self'`);
    const frameSrc = policy
      .split(';')
      .find((directive) => directive.trim().startsWith('frame-src'));

    expect(frameSrc).toContain('https://challenges.cloudflare.com');
    expect(frameSrc).toContain('https://www.youtube-nocookie.com');
    expect(frameSrc).toContain('https://player.vimeo.com');
    expect(frameSrc).toContain('https://www.google.com');
  });

  it('blocks plugins and base-tag hijacking unconditionally', () => {
    const policy = buildContentSecurityPolicy(`'self'`);

    expect(policy).toContain(`object-src 'none'`);
    expect(policy).toContain(`base-uri 'self'`);
  });
});
