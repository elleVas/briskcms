import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { PageRecord, SiteRecord } from '@brisk/shared-types';
import * as pagesApi from '../lib/pages-api-client.js';
import * as sitesApi from '../lib/sites-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { usePageTranslations } from './use-page-translations.js';

vi.mock('../lib/pages-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client.js')>();
  return {
    ...actual,
    listTranslations: vi.fn(),
    markTranslationSynced: vi.fn(),
  };
});

vi.mock('../lib/sites-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/sites-api-client.js')>();
  return { ...actual, getSite: vi.fn() };
});

function page(overrides: Partial<PageRecord>): PageRecord {
  return {
    id: 'page-it',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    groupId: 'group-1',
    locale: 'it',
    slug: 'chi-siamo',
    parentId: null,
    status: 'draft',
    content: [{ type: 'Hero', props: {} }],
    publishedContent: null,
    seoMeta: { title: 'Chi siamo', description: '' },
    syncedStructureSignature: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function site(overrides: Partial<SiteRecord> = {}): SiteRecord {
  return {
    id: 'site-1',
    tenantId: 'tenant-1',
    name: 'Sito',
    domain: null,
    defaultLocale: 'it',
    enabledLocales: ['it', 'en'],
    untranslatedPageFallback: 'redirect-to-default',
    businessAddress: null,
    businessPhone: null,
    businessType: null,
    openingHours: null,
    searchEngineIndexingEnabled: false,
    themePrimaryColor: null,
    themeSecondaryColor: null,
    themeFontFamily: null,
    themeCustomCss: null,
    themeHeadScript: null,
    themeBodyScript: null,
    themeFaviconUrl: null,
    themeOverridesEnabled: true,
    themeAllowedTrackerDomains: [],
    themeTokens: { blockStyles: {} },
    createdAt: '',
    ...overrides,
  };
}

function renderTranslations() {
  return renderHook(() => usePageTranslations('page-it', 'site-1', true), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={createTestQueryClient()}>
        {children}
      </QueryClientProvider>
    ),
  });
}

describe('usePageTranslations', () => {
  it('is not flagged when the stored signature still matches the default-locale page', async () => {
    vi.mocked(sitesApi.getSite).mockResolvedValue(site());
    vi.mocked(pagesApi.listTranslations).mockResolvedValue([
      page({
        id: 'page-it',
        locale: 'it',
        content: [{ type: 'Hero', props: {} }],
      }),
      page({
        id: 'page-en',
        locale: 'en',
        slug: 'about-us',
        syncedStructureSignature: JSON.stringify([{ type: 'Hero' }]),
        content: [{ type: 'Hero', props: {} }],
      }),
    ]);

    const { result } = renderTranslations();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const en = result.current.translations.find((t) => t.locale === 'en');
    expect(en?.hasStructuralDrift).toBe(false);
  });

  it('flags a translation once the default-locale page gains a block it never saw', async () => {
    vi.mocked(sitesApi.getSite).mockResolvedValue(site());
    vi.mocked(pagesApi.listTranslations).mockResolvedValue([
      page({
        id: 'page-it',
        locale: 'it',
        content: [
          { type: 'Hero', props: {} },
          { type: 'Text', props: {} },
        ],
      }),
      page({
        id: 'page-en',
        locale: 'en',
        slug: 'about-us',
        // Signature recorded back when `it` had only a Hero block.
        syncedStructureSignature: JSON.stringify([{ type: 'Hero' }]),
        content: [{ type: 'Hero', props: {} }],
      }),
    ]);

    const { result } = renderTranslations();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const en = result.current.translations.find((t) => t.locale === 'en');
    expect(en?.hasStructuralDrift).toBe(true);
  });

  it('never flags the default-locale page itself', async () => {
    vi.mocked(sitesApi.getSite).mockResolvedValue(site());
    vi.mocked(pagesApi.listTranslations).mockResolvedValue([
      page({ id: 'page-it', locale: 'it' }),
    ]);

    const { result } = renderTranslations();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.translations[0].hasStructuralDrift).toBe(false);
  });

  it("marking a translation synced calls the API with the default-locale page's current signature", async () => {
    vi.mocked(sitesApi.getSite).mockResolvedValue(site());
    vi.mocked(pagesApi.listTranslations).mockResolvedValue([
      page({
        id: 'page-it',
        locale: 'it',
        content: [{ type: 'Hero', props: {} }],
      }),
      page({
        id: 'page-en',
        locale: 'en',
        slug: 'about-us',
        syncedStructureSignature: 'stale',
      }),
    ]);
    vi.mocked(pagesApi.markTranslationSynced).mockResolvedValue(
      page({ id: 'page-en', locale: 'en' }),
    );

    const { result } = renderTranslations();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.markSynced('page-en');

    expect(pagesApi.markTranslationSynced).toHaveBeenCalledWith(
      'page-en',
      JSON.stringify([{ type: 'Hero' }]),
    );
  });
});
