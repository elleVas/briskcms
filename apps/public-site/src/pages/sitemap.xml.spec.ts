import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../lib/public-api-client.js';
import { GET } from './sitemap.xml.js';

vi.mock('../lib/public-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/public-api-client.js')>();
  return { ...actual, listPublishedPagesForSitemap: vi.fn() };
});

describe('GET /sitemap.xml', () => {
  beforeEach(() => {
    vi.mocked(api.listPublishedPagesForSitemap).mockResolvedValue([
      { slug: 'home', updatedAt: '2026-01-01T00:00:00.000Z' },
      { slug: 'chi-siamo', updatedAt: '2026-01-02T00:00:00.000Z' },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('maps the "home" slug to "/" instead of a literal /home entry', async () => {
    const url = new URL('https://example.com/sitemap.xml');
    // @ts-expect-error -- only `url` is exercised by this handler
    const res = await GET({ url });
    const body = await res.text();

    expect(body).toContain('<loc>https://example.com/</loc>');
    expect(body).not.toContain('/home<');
  });

  it('renders every other slug as its own path with a lastmod', async () => {
    const url = new URL('https://example.com/sitemap.xml');
    // @ts-expect-error -- only `url` is exercised by this handler
    const res = await GET({ url });
    const body = await res.text();

    expect(body).toContain('<loc>https://example.com/chi-siamo</loc>');
    expect(body).toContain('<lastmod>2026-01-02T00:00:00.000Z</lastmod>');
  });

  it('queries the API by the request hostname', async () => {
    const url = new URL('https://mysite.example/sitemap.xml');
    // @ts-expect-error -- only `url` is exercised by this handler
    await GET({ url });

    expect(api.listPublishedPagesForSitemap).toHaveBeenCalledWith(
      'mysite.example',
    );
  });

  it('serves valid XML with the right content type', async () => {
    const url = new URL('https://example.com/sitemap.xml');
    // @ts-expect-error -- only `url` is exercised by this handler
    const res = await GET({ url });

    expect(res.headers.get('Content-Type')).toContain('application/xml');
    const body = await res.text();
    expect(body.startsWith('<?xml version="1.0"')).toBe(true);
  });
});
