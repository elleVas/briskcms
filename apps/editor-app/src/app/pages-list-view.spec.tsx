import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import { TooltipProvider } from '../components/ui/tooltip';
import * as api from '../lib/pages-api-client';
import type { PageRecord, PageListItem } from '../lib/pages-api-client';
import { createTestQueryClient } from '../test-query-client';
import { pagesListReducer, PagesListView } from './pages-list-view';

const initialState = {
  selectedPageId: null,
  openDialog: 'none' as const,
  actionError: '',
};

describe('pagesListReducer', () => {
  it('selects a page and closes any open dialog', () => {
    const state = { ...initialState, openDialog: 'seo' as const };

    expect(
      pagesListReducer(state, { type: 'TOGGLE_SELECTED', pageId: 'page-1' }),
    ).toEqual({
      selectedPageId: 'page-1',
      openDialog: 'none',
      actionError: '',
    });
  });

  it('deselects (and closes any dialog) when toggling the already-selected page', () => {
    const state = {
      selectedPageId: 'page-1',
      openDialog: 'delete' as const,
      actionError: 'oops',
    };

    expect(
      pagesListReducer(state, { type: 'TOGGLE_SELECTED', pageId: 'page-1' }),
    ).toEqual({ selectedPageId: null, openDialog: 'none', actionError: '' });
  });

  it('switching selection clears a stale error from the previous page', () => {
    const state = {
      selectedPageId: 'page-1',
      openDialog: 'none' as const,
      actionError: 'network down',
    };

    expect(
      pagesListReducer(state, { type: 'TOGGLE_SELECTED', pageId: 'page-2' }),
    ).toEqual({
      selectedPageId: 'page-2',
      openDialog: 'none',
      actionError: '',
    });
  });

  it('opens the requested dialog', () => {
    expect(
      pagesListReducer(initialState, {
        type: 'OPEN_DIALOG',
        dialog: 'delete',
      }),
    ).toEqual({ ...initialState, openDialog: 'delete' });
  });

  it('closes whichever dialog is open', () => {
    const state = { ...initialState, openDialog: 'duplicate' as const };

    expect(pagesListReducer(state, { type: 'CLOSE_DIALOG' })).toEqual(
      initialState,
    );
  });

  it('sets and clears the action error independently of selection/dialog', () => {
    const state = { ...initialState, selectedPageId: 'page-1' };

    const withError = pagesListReducer(state, {
      type: 'SET_ERROR',
      error: 'boom',
    });
    expect(withError).toEqual({ ...state, actionError: 'boom' });

    expect(
      pagesListReducer(withError, { type: 'SET_ERROR', error: '' }),
    ).toEqual(state);
  });
});

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: vi.fn() };
});

vi.mock('../lib/pages-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client')>();
  return {
    ...actual,
    createPage: vi.fn(),
    deletePage: vi.fn(),
    publishPage: vi.fn(),
    // Every row (and NewPageDialog) renders a ParentPageSelect, which
    // queries listPages on its own — mocked here so it resolves
    // immediately instead of hitting the real fetch().
    listPages: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    setPageParent: vi.fn(),
    // Only fetched when the delete dialog opens on a default-locale page
    // (see pages-list-view.tsx); empty by default so unrelated tests never
    // hit a real, unmocked fetch().
    listTranslations: vi.fn().mockResolvedValue([]),
  };
});

const pageOne: PageListItem = {
  id: 'page-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  groupId: 'group-1',
  parentId: null,
  locale: 'it',
  slug: 'home',
  status: 'published',
  seoMeta: { title: 'Home', description: '' },
  order: 0,
  createdByName: null,
  createdAt: '',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hasUnpublishedChanges: false,
};

function renderView(
  pages: PageListItem[],
  options: { page?: number; total?: number } = {},
) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <PagesListView
          siteId="site-1"
          defaultLocale="it"
          pages={pages}
          page={options.page ?? 1}
          total={options.total ?? pages.length}
        />
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

  it('lists pages without per-row action buttons, showing the name and the slug', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView([pageOne]);

    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('home')).toBeTruthy();
    expect(screen.getByText('Pubblicata')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /elimina/i })).toBeNull();
  });

  it('flags a published page whose draft has diverged from what is live', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    const pageWithPendingChanges: PageListItem = {
      ...pageOne,
      hasUnpublishedChanges: true,
    };

    renderView([pageWithPendingChanges]);

    expect(screen.getByText('Modifiche non pubblicate')).toBeTruthy();
  });

  it('does not flag a published page whose draft matches what is live', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView([pageOne]);

    expect(screen.queryByText('Modifiche non pubblicate')).toBeNull();
  });

  it('has no pagination controls when everything fits on one page', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView([pageOne], { total: 1 });

    expect(screen.queryByText(/pagina 1 di/i)).toBeNull();
  });

  it('navigates to the next/previous page', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);

    renderView([pageOne], { page: 2, total: 45 });

    expect(screen.getByText('Pagina 2 di 3')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /pagina successiva/i }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/pages',
        search: { page: 3 },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /pagina precedente/i }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/pages',
        search: { page: 1 },
      }),
    );
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
    expect(screen.getByRole('button', { name: /^seo$/i })).toBeTruthy();

    fireEvent.click(row);
    expect(row.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: /^elimina$/i })).toBeNull();
  });

  it('opens the SEO panel for the selected page without opening the full editor', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView([pageOne]);
    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    fireEvent.click(screen.getByRole('button', { name: /^seo$/i }));

    expect(screen.getByDisplayValue('Home')).toBeTruthy();
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
    const publishedPage: PageRecord = {
      ...pageOne,
      content: [],
      publishedContent: [],
      syncedStructureSignature: null,
    };
    vi.mocked(api.publishPage).mockResolvedValue(publishedPage);

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

  it('warns when deleting a default-locale page that has translations in other locales', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    const itRecord: PageRecord = {
      id: pageOne.id,
      tenantId: pageOne.tenantId,
      siteId: pageOne.siteId,
      groupId: pageOne.groupId,
      parentId: pageOne.parentId,
      locale: pageOne.locale,
      slug: pageOne.slug,
      status: pageOne.status,
      seoMeta: pageOne.seoMeta,
      createdAt: pageOne.createdAt,
      updatedAt: pageOne.updatedAt,
      content: [],
      publishedContent: [],
      syncedStructureSignature: null,
    };
    const enRecord: PageRecord = {
      ...itRecord,
      id: 'page-2',
      locale: 'en',
      slug: 'home-en',
    };
    vi.mocked(api.listTranslations).mockResolvedValue([itRecord, enRecord]);

    renderView([pageOne]);
    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    fireEvent.click(screen.getByRole('button', { name: /^elimina$/i }));

    expect(
      await screen.findByText(/lingua predefinita del sito/i),
    ).toBeTruthy();
    expect(screen.getByText(/\(en\)/)).toBeTruthy();
  });

  it('does not warn when deleting a default-locale page that has no other translations', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    const itRecord: PageRecord = {
      id: pageOne.id,
      tenantId: pageOne.tenantId,
      siteId: pageOne.siteId,
      groupId: pageOne.groupId,
      parentId: pageOne.parentId,
      locale: pageOne.locale,
      slug: pageOne.slug,
      status: pageOne.status,
      seoMeta: pageOne.seoMeta,
      createdAt: pageOne.createdAt,
      updatedAt: pageOne.updatedAt,
      content: [],
      publishedContent: [],
      syncedStructureSignature: null,
    };
    vi.mocked(api.listTranslations).mockResolvedValue([itRecord]);

    renderView([pageOne]);
    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    fireEvent.click(screen.getByRole('button', { name: /^elimina$/i }));

    expect(screen.getByText(/eliminare questa pagina/i)).toBeTruthy();
    expect(screen.queryByText(/lingua predefinita del sito/i)).toBeNull();
  });

  it('selecting a different page after a successful delete does not reopen the delete dialog for it (regression: the dialog-open flag used to survive the delete)', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(api.deletePage).mockResolvedValue(undefined);
    const pageTwo: PageListItem = {
      ...pageOne,
      id: 'page-2',
      slug: 'chi-siamo',
      seoMeta: { title: 'Chi Siamo', description: '' },
    };

    renderView([pageOne, pageTwo]);
    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    fireEvent.click(screen.getByRole('button', { name: /^elimina$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^elimina$/i }));
    await waitFor(() =>
      expect(api.deletePage).toHaveBeenCalledWith(pageOne.id),
    );

    fireEvent.click(screen.getByRole('button', { name: /chi siamo/i }));

    expect(screen.queryByText(/eliminare questa pagina/i)).toBeNull();
  });

  it('opens the new page dialog', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderView([]);
    fireEvent.click(screen.getByRole('button', { name: /nuova pagina/i }));

    expect(screen.getByRole('heading', { name: /nuova pagina/i })).toBeTruthy();
  });
});
