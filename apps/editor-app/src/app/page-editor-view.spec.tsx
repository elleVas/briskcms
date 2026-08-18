import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import { TooltipProvider } from '../components/ui/tooltip.js';
import * as api from '../lib/pages-api-client.js';
import type { PageDto } from '../lib/pages-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { pageQueryOptions } from './pages-queries.js';
import { PageEditorView } from './page-editor-view.js';

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
  };
});

const samplePage: PageDto = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  locale: 'it',
  slug: 'test-page',
  status: 'draft',
  content: [],
  publishedContent: null,
  seoMeta: { title: 'Test', description: 'desc' },
  createdAt: '',
  updatedAt: '',
};

function renderView(page: PageDto = samplePage) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(pageQueryOptions(page.id).queryKey, page);
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PageEditorView pageId={page.id} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('PageEditorView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a link back to the pages list and a logout control', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView();

    expect(
      screen.getByRole('link', { name: /pagine/i }).getAttribute('href'),
    ).toBe('/pages');
    expect(screen.getByRole('button', { name: /^esci$/i })).toBeTruthy();
  });

  it('opens the SEO panel with the current seoMeta pre-filled', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView();
    fireEvent.click(screen.getByRole('button', { name: /^seo$/i }));

    expect(screen.getByDisplayValue('Test')).toBeTruthy();
  });

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
  });

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
  });

  it('links to the public page when it is published', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView({ ...samplePage, status: 'published', slug: 'chi-siamo' });

    const link = screen.getByRole('link', { name: /visualizza pagina/i });
    expect(link.getAttribute('href')).toMatch(/\/chi-siamo$/);
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('has no public-page link for a page that is still a draft', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView({ ...samplePage, status: 'draft' });

    expect(
      screen.queryByRole('link', { name: /visualizza pagina/i }),
    ).toBeNull();
  });
});
