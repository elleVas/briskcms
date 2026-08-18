import type { Page } from '@brisk/domain-core';
import type { PageRepositoryPort } from '@brisk/ports';

export interface ListPagesDeps {
  pageRepository: PageRepositoryPort;
}

export interface ListPagesInput {
  tenantId: string;
  siteId: string;
}

export function listPages(
  deps: ListPagesDeps,
  input: ListPagesInput,
): Promise<Page[]> {
  return deps.pageRepository.listBySite(input.tenantId, input.siteId);
}
