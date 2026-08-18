import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublishedPageDto } from './public-api-client.js';
import { getPublishedPageBySlug } from './public-api-client.js';

const samplePage: PublishedPageDto = {
  content: [{ type: 'Hero', props: { title: 'Ciao', subtitle: 'Sub' } }],
  seoMeta: { title: 'Chi siamo', description: 'La nostra storia' },
  locale: 'it',
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('public-api-client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the published page by domain and slug', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(samplePage));

    const result = await getPublishedPageBySlug('example.com', 'chi-siamo');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        '/public/pages/by-slug?domain=example.com&slug=chi-siamo',
      ),
    );
    expect(result).toEqual(samplePage);
  });

  it('returns null on a 404 instead of throwing', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: 'Not Found' }, 404),
    );

    const result = await getPublishedPageBySlug('example.com', 'non-esiste');

    expect(result).toBeNull();
  });

  it('throws on any other non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: 'boom' }, 500));

    await expect(
      getPublishedPageBySlug('example.com', 'chi-siamo'),
    ).rejects.toThrow('Public pages API error: 500');
  });
});
