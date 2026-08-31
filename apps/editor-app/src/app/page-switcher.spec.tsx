import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import * as api from '../lib/pages-api-client';
import type { PageListItem } from '../lib/pages-api-client';
import { createTestQueryClient } from '../test-query-client';
import { PageSwitcher } from './page-switcher';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: vi.fn() };
});

vi.mock('../lib/pages-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/pages-api-client')>();
  return { ...actual, listPages: vi.fn() };
});

function page(id: string, slug: string): PageListItem {
  return {
    id,
    tenantId: 'tenant-1',
    siteId: 'site-1',
    groupId: `group-${id}`,
    parentId: null,
    locale: 'it',
    slug,
    status: 'draft',
    seoMeta: { title: slug, description: '' },
    order: 0,
    createdByName: null,
    createdAt: '',
    updatedAt: '',
    hasUnpublishedChanges: false,
  };
}

describe('PageSwitcher', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderSwitcher() {
    return render(
      <QueryClientProvider client={createTestQueryClient()}>
        <PageSwitcher
          siteId="site-1"
          currentPageId="page-1"
          currentLabel="home"
        />
      </QueryClientProvider>,
    );
  }

  it('does not fetch the pages list until opened', () => {
    vi.mocked(api.listPages).mockResolvedValue({ items: [], total: 0 });
    renderSwitcher();

    expect(api.listPages).not.toHaveBeenCalled();
  });

  it('lists the site pages once opened, marking the current one', async () => {
    vi.mocked(api.listPages).mockResolvedValue({
      items: [page('page-1', 'home'), page('page-2', 'contatti')],
      total: 2,
    });
    renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: /home/ }));

    await waitFor(() => expect(screen.getByText('contatti')).toBeTruthy());
    expect(api.listPages).toHaveBeenCalledWith('site-1', 1, 20);
  });

  it('navigates to the selected page', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);
    vi.mocked(api.listPages).mockResolvedValue({
      items: [page('page-1', 'home'), page('page-2', 'contatti')],
      total: 2,
    });
    renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: /home/ }));
    await waitFor(() => screen.getByText('contatti'));
    fireEvent.click(screen.getByText('contatti'));

    expect(navigate).toHaveBeenCalledWith({
      to: '/pages/$pageId',
      params: { pageId: 'page-2' },
    });
  });

  it('does not navigate when picking the page already open', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);
    vi.mocked(api.listPages).mockResolvedValue({
      items: [page('page-1', 'home')],
      total: 1,
    });
    renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: /home/ }));
    await waitFor(() => expect(screen.getAllByText('home')).toHaveLength(2));
    fireEvent.click(screen.getAllByText('home')[1]);

    expect(navigate).not.toHaveBeenCalled();
  });
});
