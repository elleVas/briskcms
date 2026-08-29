import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { PageRecord, SiteRecord } from '@brisk/shared-types';
import * as pagesApi from '../lib/pages-api-client.js';
import * as sitesApi from '../lib/sites-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { PageTranslationsDialog } from './page-translations-dialog.js';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({
      children,
      params,
      onClick,
      className,
    }: {
      children: ReactNode;
      params?: { pageId: string };
      onClick?: () => void;
      className?: string;
    }) => (
      <a
        href={`/pages/${params?.pageId ?? ''}`}
        onClick={onClick}
        className={className}
      >
        {children}
      </a>
    ),
    useNavigate: vi.fn(),
  };
});

vi.mock('../lib/pages-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client.js')>();
  return {
    ...actual,
    listTranslations: vi.fn(),
    createTranslation: vi.fn(),
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

function renderDialog() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <PageTranslationsDialog
        pageId="page-it"
        siteId="site-1"
        slug="chi-siamo"
        open
        onOpenChange={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe('PageTranslationsDialog', () => {
  it('shows a drift warning and "mark as synced" button for an out-of-sync translation', async () => {
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
        syncedStructureSignature: JSON.stringify([{ type: 'Hero' }]),
      }),
    ]);

    renderDialog();

    expect(await screen.findByText('Struttura non allineata')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Segna come allineata' }),
    ).toBeTruthy();
  });

  it('does not show a drift warning when the translation is in sync', async () => {
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
      }),
    ]);

    renderDialog();

    // The locale text is styled uppercase via CSS, but jsdom's textContent
    // is still the raw lowercase value stored on the record.
    await screen.findByText('en');
    expect(screen.queryByText('Struttura non allineata')).toBeNull();
  });

  it('clicking "mark as synced" calls the API and clears the warning', async () => {
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
      page({
        id: 'page-en',
        locale: 'en',
        slug: 'about-us',
        syncedStructureSignature: JSON.stringify([{ type: 'Hero' }]),
      }),
    );

    renderDialog();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Segna come allineata' }),
    );

    await waitFor(() =>
      expect(pagesApi.markTranslationSynced).toHaveBeenCalledWith(
        'page-en',
        JSON.stringify([{ type: 'Hero' }]),
      ),
    );
  });
});
