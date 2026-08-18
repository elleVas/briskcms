import { describe, expect, it } from 'vitest';
import { GET } from './robots.txt.js';

describe('GET /robots.txt', () => {
  it('allows everything and points to the sitemap at the request origin', async () => {
    const url = new URL('https://example.com/robots.txt');
    // @ts-expect-error -- only `url` is exercised by this handler
    const res = await GET({ url });
    const body = await res.text();

    expect(body).toContain('User-agent: *');
    expect(body).toContain('Allow: /');
    expect(body).toContain('Sitemap: https://example.com/sitemap.xml');
    expect(res.headers.get('Content-Type')).toContain('text/plain');
  });
});
