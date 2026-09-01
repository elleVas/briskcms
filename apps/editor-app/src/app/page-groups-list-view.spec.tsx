import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import type { PageGroupListItemRecord } from '@brisk/shared-types';
import * as api from '../lib/page-groups-api-client';
import { TooltipProvider } from '../components/ui/tooltip';
import { createTestQueryClient } from '../test-query-client';
import { EMPTY_PAGES_LIST_FILTERS } from './pages-list-filter-bar';
import { PageGroupsListView } from './page-groups-list-view';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: vi.fn() };
});

vi.mock('../lib/page-groups-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/page-groups-api-client')>();
  return {
    ...actual,
    createPageGroup: vi.fn(),
    createPageGroupTranslation: vi.fn(),
    deletePageGroup: vi.fn(),
    duplicatePageGroup: vi.fn(),
    reorderPageGroups: vi.fn(),
  };
});

const groupA: PageGroupListItemRecord = {
  id: 'group-a',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  parentId: null,
  order: 0,
  createdByName: 'Ada Lovelace',
  createdAt: '',
  updatedAt: '',
  translations: [
    {
      locale: 'it',
      slug: 'chi-siamo',
      title: 'Chi siamo',
      status: 'published',
      isDiverged: false,
    },
  ],
};

const groupB: PageGroupListItemRecord = {
  ...groupA,
  id: 'group-b',
  order: 1,
  translations: [
    {
      locale: 'it',
      slug: 'contatti',
      title: 'Contatti',
      status: 'draft',
      isDiverged: false,
    },
  ],
};

function renderView(
  overrides: Partial<{
    groups: PageGroupListItemRecord[];
    page: number;
    total: number;
    filters: typeof EMPTY_PAGES_LIST_FILTERS;
  }> = {},
) {
  const onFiltersChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TooltipProvider>
        <PageGroupsListView
          siteId="site-1"
          defaultLocale="it"
          enabledLocales={['it']}
          groups={overrides.groups ?? [groupA, groupB]}
          page={overrides.page ?? 1}
          total={
            overrides.total ?? (overrides.groups ?? [groupA, groupB]).length
          }
          filters={overrides.filters ?? EMPTY_PAGES_LIST_FILTERS}
          onFiltersChange={onFiltersChange}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...utils, onFiltersChange };
}

describe('PageGroupsListView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders one row per group, with title and status/locale badges', () => {
    renderView();

    expect(screen.getByText('Chi siamo')).toBeTruthy();
    expect(screen.getByText('Contatti')).toBeTruthy();
  });

  it('selecting a row reveals edit/duplicate/delete actions', () => {
    renderView();

    expect(screen.queryByRole('button', { name: 'Duplica pagina' })).toBeNull();

    fireEvent.click(screen.getByText('Chi siamo'));

    expect(screen.getByRole('button', { name: 'Duplica pagina' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Elimina' })).toBeTruthy();
  });

  it('duplicating the selected group calls duplicatePageGroup', async () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());
    vi.mocked(api.duplicatePageGroup).mockResolvedValue({
      id: 'group-a-copy',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      parentId: null,
      order: 2,
      content: [],
      createdBy: null,
      createdAt: '',
      updatedAt: '',
    });
    renderView();

    fireEvent.click(screen.getByText('Chi siamo'));
    fireEvent.click(screen.getByRole('button', { name: 'Duplica pagina' }));

    await vi.waitFor(() =>
      expect(api.duplicatePageGroup).toHaveBeenCalledWith('group-a'),
    );
  });

  it('shows a drag handle for every row when unfiltered and on a single page', () => {
    renderView();

    expect(
      screen.getAllByRole('button', { name: 'Trascina per riordinare' }),
    ).toHaveLength(2);
  });

  it('hides the drag handle while a filter is active (a drag could not be a real full-sibling permutation)', () => {
    renderView({ filters: { ...EMPTY_PAGES_LIST_FILTERS, search: 'chi' } });

    expect(
      screen.queryByRole('button', { name: 'Trascina per riordinare' }),
    ).toBeNull();
  });

  it('hides the drag handle when there is more than one page of results', () => {
    renderView({ total: 100 });

    expect(
      screen.queryByRole('button', { name: 'Trascina per riordinare' }),
    ).toBeNull();
  });
});
