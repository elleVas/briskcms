import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import * as api from '../lib/pages-api-client.js';
import type { PageDto } from '../lib/pages-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { PagesListView } from './pages-list-view.js';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
      className,
    }: {
      children: ReactNode;
      to: string;
      params?: Record<string, string>;
      className?: string;
    }) => (
      <a
        href={to}
        data-params={params ? JSON.stringify(params) : undefined}
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
  return { ...actual, createPage: vi.fn() };
});

const pageOne: PageDto = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  locale: 'it',
  slug: 'home',
  status: 'published',
  content: [],
  publishedContent: [],
  seoMeta: { title: 'Home', description: '' },
  createdAt: '',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderView(pages: PageDto[]) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <PagesListView siteId="site-1" pages={pages} />
    </QueryClientProvider>,
  );
}

describe('PagesListView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state when there are no pages', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView([]);

    expect(screen.getByText(/nessuna pagina/i)).toBeTruthy();
  });

  it('lists each page linking to its editor', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView([pageOne]);

    const link = screen.getByRole('link', { name: /home/i });
    expect(link.getAttribute('href')).toBe('/pages/$pageId');
    expect(link.getAttribute('data-params')).toBe(
      JSON.stringify({ pageId: pageOne.id }),
    );
    expect(screen.getByText('Pubblicata')).toBeTruthy();
  });

  it('creating a page posts for the given site and navigates to its editor', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);
    vi.mocked(api.createPage).mockResolvedValue(pageOne);

    renderView([]);
    fireEvent.click(screen.getByRole('button', { name: /nuova pagina/i }));

    await waitFor(() =>
      expect(api.createPage).toHaveBeenCalledWith(
        expect.objectContaining({ siteId: 'site-1' }),
      ),
    );
    expect(navigate).toHaveBeenCalledWith({
      to: '/pages/$pageId',
      params: { pageId: pageOne.id },
    });
  });

  it('shows an error when creating a page fails', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(api.createPage).mockRejectedValue(new Error('boom'));

    renderView([]);
    fireEvent.click(screen.getByRole('button', { name: /nuova pagina/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('boom'),
    );
  });
});
