import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import { TooltipProvider } from '../components/ui/tooltip.js';
import * as api from '../lib/pages-api-client.js';
import type { PageRecord } from '../lib/pages-api-client.js';
import * as sitesApi from '../lib/sites-api-client.js';
import type { SiteRecord } from '@brisk/shared-types';
import * as previewTokenApi from '../lib/preview-token-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { pageQueryOptions } from './pages-queries.js';
import { PageEditorView } from './page-editor-view.js';
import { ToastProvider } from './toast-provider.js';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      className,
    }: {
      children: ReactNode;
      to: string;
      className?: string;
    }) => (
      <a href={to} className={className}>
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
    listPageVersions: vi.fn(),
    rollbackToVersion: vi.fn(),
    listTranslations: vi.fn(),
    createTranslation: vi.fn(),
  };
});

vi.mock('../lib/sites-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/sites-api-client.js')>();
  return { ...actual, getSite: vi.fn() };
});

// CanvasEditorShell/CanvasFrame mint a real preview token on mount — mocked
// here so these tests never make a real network call to apps/api (these
// tests exercise the view's own wiring, not the canvas itself, which has
// its own dedicated specs).
vi.mock('../lib/preview-token-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/preview-token-api-client.js')>();
  return { ...actual, createPagePreviewToken: vi.fn() };
});

const samplePage: PageRecord = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  parentId: null,
  locale: 'it',
  slug: 'test-page',
  status: 'draft',
  syncedStructureSignature: null,
  content: [],
  publishedContent: null,
  seoMeta: { title: 'Test', description: 'desc' },
  createdAt: '',
  updatedAt: '',
};

const sampleSite: SiteRecord = {
  id: 'site-1',
  tenantId: 'tenant-1',
  name: 'Il mio sito',
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
};

function renderView(page: PageRecord = samplePage) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(pageQueryOptions(page.id).queryKey, page);
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ToastProvider>
          <PageEditorView pageId={page.id} />
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('PageEditorView', () => {
  beforeEach(() => {
    vi.mocked(previewTokenApi.createPagePreviewToken).mockResolvedValue({
      token: 'tok123',
      expiresAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a link back to the pages list', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView();

    expect(
      screen.getByRole('link', { name: /pagine/i }).getAttribute('href'),
    ).toBe('/pages');
  });

  it('opens the SEO panel with the current seoMeta pre-filled', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView();
    fireEvent.click(screen.getByRole('button', { name: /^seo$/i }));

    expect(screen.getByDisplayValue('Test')).toBeTruthy();
  });

  // Longer timeout than the vitest default (5000ms): this test mounts the
  // full Puck editor (puckConfig now registers 25 blocks) on top of the
  // async dialog/query-mock flow — comfortably fast locally, but the
  // combined cost occasionally tips over 5000ms on a loaded CI runner.
  it('opens the version history dialog and lists past versions newest-first', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(api.listPageVersions).mockResolvedValue([
      {
        id: 'v1',
        tenantId: 'tenant-1',
        pageId: samplePage.id,
        content: [],
        createdBy: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'v2',
        tenantId: 'tenant-1',
        pageId: samplePage.id,
        content: [],
        createdBy: null,
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]);

    renderView();
    fireEvent.click(
      screen.getByRole('button', { name: /cronologia versioni/i }),
    );

    await waitFor(() =>
      expect(api.listPageVersions).toHaveBeenCalledWith(samplePage.id),
    );
    const restoreButtons = await screen.findAllByRole('button', {
      name: /^ripristina$/i,
    });
    expect(restoreButtons).toHaveLength(1);
    expect(screen.getByText(/versione attuale/i)).toBeTruthy();
  }, 10000);

  // Same reasoning as the test above: full Puck editor mount + the version
  // dialog's async flow, plus a rollback round-trip on top.
  it('restores a past version and closes the dialog', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(api.listPageVersions).mockResolvedValue([
      {
        id: 'v1',
        tenantId: 'tenant-1',
        pageId: samplePage.id,
        content: [],
        createdBy: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'v2',
        tenantId: 'tenant-1',
        pageId: samplePage.id,
        content: [],
        createdBy: null,
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    vi.mocked(api.rollbackToVersion).mockResolvedValue({
      ...samplePage,
      updatedAt: '2026-01-03T00:00:00.000Z',
    });

    renderView();
    fireEvent.click(
      screen.getByRole('button', { name: /cronologia versioni/i }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /^ripristina$/i }),
    );

    await waitFor(() =>
      expect(api.rollbackToVersion).toHaveBeenCalledWith(samplePage.id, 'v1'),
    );
    await waitFor(() =>
      expect(screen.queryByText(/versione attuale/i)).toBeNull(),
    );
  }, 10000);

  it('links to the public page when it is published', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView({
      ...samplePage,
      status: 'published',
      locale: 'it',
      slug: 'chi-siamo',
    });

    const link = screen.getByRole('link', { name: /visualizza pagina/i });
    expect(link.getAttribute('href')).toMatch(/\/it\/chi-siamo$/);
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('has no public-page link for a page that is still a draft', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView({ ...samplePage, status: 'draft' });

    expect(
      screen.queryByRole('link', { name: /visualizza pagina/i }),
    ).toBeNull();
  });

  it('opens the translations dialog, listing this page and the missing locale', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(api.listTranslations).mockResolvedValue([samplePage]);
    vi.mocked(sitesApi.getSite).mockResolvedValue(sampleSite);

    renderView();
    fireEvent.click(screen.getByRole('button', { name: /traduzioni/i }));

    expect(await screen.findByText(/questa pagina/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'EN' })).toBeTruthy();
  });

  // Longer timeout than vitest's 5000ms default: two sequential waitFors
  // plus a findByRole comfortably finish under 1.5s locally, but this
  // exact test has intermittently hit the default timeout on CI's
  // --parallel=1 sequential run under load — see
  // memory/flaky-test-page-editor-translation.md, confirmed unrelated to
  // any code change (failed on PRs that never touched this file).
  it('creates a translation and navigates to its editor', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);
    vi.mocked(api.listTranslations).mockResolvedValue([samplePage]);
    vi.mocked(sitesApi.getSite).mockResolvedValue(sampleSite);
    vi.mocked(api.createTranslation).mockResolvedValue({
      ...samplePage,
      id: 'page-2',
      locale: 'en',
      slug: 'test-page-en',
    });

    renderView();
    fireEvent.click(screen.getByRole('button', { name: /traduzioni/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'EN' }));
    fireEvent.click(screen.getByRole('button', { name: /crea traduzione/i }));

    await waitFor(() =>
      expect(api.createTranslation).toHaveBeenCalledWith(samplePage.id, {
        locale: 'en',
        slug: 'test-page',
      }),
    );
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/pages/$pageId',
        params: { pageId: 'page-2' },
      }),
    );
  }, 15000);
});
