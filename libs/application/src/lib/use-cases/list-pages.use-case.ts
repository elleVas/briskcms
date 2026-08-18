import type { Page } from '@brisk/domain-core';
import type { PaginatedResult, PageRepositoryPort } from '@brisk/ports';

export interface ListPagesDeps {
  pageRepository: PageRepositoryPort;
}

export interface ListPagesInput {
  tenantId: string;
  siteId: string;
  page: number;
  pageSize: number;
}

export function listPages(
  deps: ListPagesDeps,
  input: ListPagesInput,
): Promise<PaginatedResult<Page>> {
  return deps.pageRepository.listBySite(input.tenantId, input.siteId, {
    page: input.page,
    pageSize: input.pageSize,
  });
}
