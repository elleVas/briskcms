import type {
  PageGroupListFilters,
  PageGroupListItem,
  PageGroupRepositoryPort,
  PaginatedResult,
} from '@brisk/ports';

export interface ListPageGroupsDeps {
  pageGroupRepository: PageGroupRepositoryPort;
}

export interface ListPageGroupsInput {
  tenantId: string;
  siteId: string;
  page: number;
  pageSize: number;
  filters?: PageGroupListFilters;
}

/**
 * Fase 4's pages-list view — one row per PageGroup, filterable.
 *
 * A section of the editor comes back as a feed, newest first; the site's
 * own pages come back in the order somebody dragged them into. That rule
 * lives here rather than in the repository, which should be told what
 * order to return and not have to infer it from a filter.
 */
export function listPageGroups(
  deps: ListPageGroupsDeps,
  input: ListPageGroupsInput,
): Promise<PaginatedResult<PageGroupListItem>> {
  const filters = input.filters ?? {};
  return deps.pageGroupRepository.listBySiteFiltered(
    input.tenantId,
    input.siteId,
    { page: input.page, pageSize: input.pageSize },
    filters,
    filters.collectionId ? 'newest' : 'tree',
  );
}
