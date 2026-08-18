import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import { TooltipProvider } from '../components/ui/tooltip.js';
import * as api from '../lib/pages-api-client.js';
import type { PageDto } from '../lib/pages-api-client.js';
import { createTestQueryClient } from '../test-query-client.js';
import { PagesListView } from './pages-list-view.js';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: vi.fn() };
});

vi.mock('../lib/pages-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client.js')>();
  return {
    ...actual,
    createPage: vi.fn(),
    deletePage: vi.fn(),
    publishPage: vi.fn(),
  };
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
      <TooltipProvider>
        <PagesListView siteId="site-1" pages={pages} />
      </TooltipProvider>
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

  it('lists pages without per-row action buttons', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView([pageOne]);

    expect(screen.getByText('home')).toBeTruthy();
    expect(screen.getByText('Pubblicata')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /elimina/i })).toBeNull();
  });

  it('selecting a row reveals the action toolbar, selecting it again hides it', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView([pageOne]);
    const row = screen.getByRole('button', { name: /home/i });
    expect(row.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: /elimina/i })).toBeNull();

    fireEvent.click(row);
    expect(row.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^elimina$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^pubblica$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /apri editor/i })).toBeTruthy();

    fireEvent.click(row);
    expect(row.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: /^elimina$/i })).toBeNull();
  });

  it('opens the editor for the selected page', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);

    renderView([pageOne]);
    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    fireEvent.click(screen.getByRole('button', { name: /apri editor/i }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/pages/$pageId',
        params: { pageId: pageOne.id },
      }),
    );
  });

  it('publishes the selected page', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(api.publishPage).mockResolvedValue(pageOne);

    renderView([pageOne]);
    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    fireEvent.click(screen.getByRole('button', { name: /^pubblica$/i }));

    await waitFor(() =>
      expect(api.publishPage).toHaveBeenCalledWith(pageOne.id),
    );
  });

  it('deletes the selected page after confirming', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(api.deletePage).mockResolvedValue(undefined);

    renderView([pageOne]);
    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    fireEvent.click(screen.getByRole('button', { name: /^elimina$/i }));

    expect(screen.getByText(/eliminare questa pagina/i)).toBeTruthy();
    // The background "Elimina" toolbar icon is aria-hidden while the modal
    // is open, so only the dialog's own confirm button is accessible here.
    fireEvent.click(screen.getByRole('button', { name: /^elimina$/i }));

    await waitFor(() =>
      expect(api.deletePage).toHaveBeenCalledWith(pageOne.id),
    );
  });

  it('opens the new page dialog', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView([]);
    fireEvent.click(screen.getByRole('button', { name: /nuova pagina/i }));

    expect(screen.getByRole('heading', { name: /nuova pagina/i })).toBeTruthy();
  });
});
