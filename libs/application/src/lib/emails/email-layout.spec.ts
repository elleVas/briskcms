import { describe, expect, it } from 'vitest';
import { ctaButtonHtml, renderEmailLayout } from './email-layout.js';

describe('ctaButtonHtml', () => {
  it('renders a link with the given URL and label', () => {
    const html = ctaButtonHtml('https://example.com/x', 'Click me');

    expect(html).toContain('href="https://example.com/x"');
    expect(html).toContain('Click me');
  });
});

describe('renderEmailLayout', () => {
  it('wraps the body content and includes the Brisk heading', () => {
    const html = renderEmailLayout('<p>Body content here</p>');

    expect(html).toContain('Brisk');
    expect(html).toContain('Body content here');
  });
});
