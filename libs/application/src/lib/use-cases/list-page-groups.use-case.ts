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

/** Fase 4's pages-list view — one row per PageGroup, filterable. */
export function listPageGroups(
  deps: ListPageGroupsDeps,
  input: ListPageGroupsInput,
): Promise<PaginatedResult<PageGroupListItem>> {
  return deps.pageGroupRepository.listBySiteFiltered(
    input.tenantId,
    input.siteId,
    { page: input.page, pageSize: input.pageSize },
    input.filters ?? {},
  );
}
