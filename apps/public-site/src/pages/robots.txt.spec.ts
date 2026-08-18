import { describe, expect, it } from 'vitest';
import { GET } from './robots.txt.js';

describe('GET /robots.txt', () => {
  it('allows all crawling and points at the sitemap', async () => {
    // @ts-expect-error deliberately partial APIContext — only `url` is used by this route.
    const res = await GET({ url: new URL('https://example.com/robots.txt') });
    const body = await res.text();

    expect(res.headers.get('Content-Type')).toBe('text/plain');
    expect(body).toContain('Allow: /');
    expect(body).toContain('Sitemap: https://example.com/sitemap.xml');
  });
});
