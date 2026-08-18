import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './sitemap.xml.js';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('GET /sitemap.xml', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists published pages as <url> entries, mapping the home slug to /', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        items: [
          { slug: 'home', updatedAt: '2026-01-01T00:00:00.000Z' },
          { slug: 'chi-siamo', updatedAt: '2026-01-02T00:00:00.000Z' },
        ],
      }),
    );

    // @ts-expect-error deliberately partial APIContext — only `url` is used by this route.
    const res = await GET({ url: new URL('https://example.com/sitemap.xml') });
    const body = await res.text();

    expect(res.headers.get('Content-Type')).toBe('application/xml');
    expect(body).toContain('<loc>https://example.com/</loc>');
    expect(body).toContain('<loc>https://example.com/chi-siamo</loc>');
    expect(body).toContain('<lastmod>2026-01-02T00:00:00.000Z</lastmod>');
  });

  it('falls back to an empty sitemap when no site matches the domain', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: 'Not Found' }, 404),
    );

    // @ts-expect-error deliberately partial APIContext
    const res = await GET({
      url: new URL('https://nobody.example/sitemap.xml'),
    });
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).not.toContain('<url>');
  });
});
