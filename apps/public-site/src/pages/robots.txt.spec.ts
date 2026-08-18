import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './robots.txt.js';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('GET /robots.txt', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('allows all crawling and points at the sitemap when indexing is enabled', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ items: [], searchEngineIndexingEnabled: true }),
    );

    // @ts-expect-error deliberately partial APIContext — only `url` is used by this route.
    const res = await GET({ url: new URL('https://example.com/robots.txt') });
    const body = await res.text();

    expect(res.headers.get('Content-Type')).toBe('text/plain');
    expect(body).toContain('Allow: /');
    expect(body).toContain('Sitemap: https://example.com/sitemap.xml');
  });

  it('blocks all crawling when the site discourages indexing', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ items: [], searchEngineIndexingEnabled: false }),
    );

    // @ts-expect-error deliberately partial APIContext
    const res = await GET({ url: new URL('https://example.com/robots.txt') });
    const body = await res.text();

    expect(body).toContain('Disallow: /');
    expect(body).not.toContain('Allow: /');
  });

  it('falls back to allowing crawling when no site matches the domain', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: 'Not Found' }, 404),
    );

    // @ts-expect-error deliberately partial APIContext
    const res = await GET({
      url: new URL('https://nobody.example/robots.txt'),
    });
    const body = await res.text();

    expect(body).toContain('Allow: /');
  });
});
