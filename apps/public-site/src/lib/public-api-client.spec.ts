import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublishedPageDto } from './public-api-client.js';
import {
  getPublicForm,
  getPublishedPageBySlug,
  listPublishedPagesForSitemap,
  submitPublicForm,
} from './public-api-client.js';

const samplePage: PublishedPageDto = {
  content: [{ type: 'Hero', props: { title: 'Ciao', subtitle: 'Sub' } }],
  seoMeta: { title: 'Chi siamo', description: 'La nostra storia' },
  locale: 'it',
  translations: [{ locale: 'it', slug: 'chi-siamo' }],
  site: {
    name: 'Sito di prova',
    domain: 'example.com',
    defaultLocale: 'it',
    enabledLocales: ['it'],
    untranslatedPageFallback: 'redirect-to-default',
    businessAddress: null,
    businessPhone: null,
    businessType: null,
    openingHours: null,
    searchEngineIndexingEnabled: false,
  },
  header: null,
  footer: null,
  headerSticky: false,
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

  it('fetches the published page by domain, locale, and slug', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(samplePage));

    const result = await getPublishedPageBySlug(
      'example.com',
      'it',
      'chi-siamo',
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        '/public/pages/by-slug?domain=example.com&locale=it&slug=chi-siamo',
      ),
    );
    expect(result).toEqual(samplePage);
  });

  it('returns null on a 404 instead of throwing', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: 'Not Found' }, 404),
    );

    const result = await getPublishedPageBySlug(
      'example.com',
      'it',
      'non-esiste',
    );

    expect(result).toBeNull();
  });

  it('throws on any other non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: 'boom' }, 500));

    await expect(
      getPublishedPageBySlug('example.com', 'it', 'chi-siamo'),
    ).rejects.toThrow('Public pages API error: 500');
  });

  it('fetches the sitemap listing, bundled with the indexing flag, for a domain', async () => {
    const items = [
      {
        slug: 'chi-siamo',
        locale: 'it',
        groupId: 'group-1',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        items,
        searchEngineIndexingEnabled: true,
        defaultLocale: 'it',
      }),
    );

    const result = await listPublishedPagesForSitemap('example.com');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/public/pages?domain=example.com'),
    );
    expect(result).toEqual({
      items,
      searchEngineIndexingEnabled: true,
      defaultLocale: 'it',
    });
  });

  it('throws when the sitemap request fails', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: 'boom' }, 500));

    await expect(listPublishedPagesForSitemap('example.com')).rejects.toThrow(
      'Public pages API error: 500',
    );
  });

  it('fetches a public form by id', async () => {
    const form = { id: 'form-1', name: 'Contatti', fields: [] };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(form));

    const result = await getPublicForm('form-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/public/forms/form-1'),
    );
    expect(result).toEqual(form);
  });

  it('getPublicForm returns null when the form does not exist', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: 'Not Found' }, 404),
    );

    const result = await getPublicForm('does-not-exist');

    expect(result).toBeNull();
  });

  it('submitPublicForm posts the submission and reports success', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(undefined, 204));

    const result = await submitPublicForm('form-1', {
      pageId: null,
      values: { email: 'visitor@example.com' },
      honeypot: '',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/public/forms/form-1/submissions'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual({ ok: true });
  });

  it('submitPublicForm reports failure with the status code, without throwing', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: 'Missing required field' }, 400),
    );

    const result = await submitPublicForm('form-1', {
      pageId: null,
      values: {},
      honeypot: '',
    });

    expect(result).toEqual({ ok: false, status: 400 });
  });
});
