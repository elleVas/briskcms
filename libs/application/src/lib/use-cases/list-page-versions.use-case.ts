import type { PageVersion } from '@brisk/domain-core';
import type { PageVersionRepositoryPort } from '@brisk/ports';

export interface ListPageVersionsDeps {
  pageVersionRepository: PageVersionRepositoryPort;
}

export interface ListPageVersionsInput {
  tenantId: string;
  pageId: string;
}

export function listPageVersions(
  deps: ListPageVersionsDeps,
  input: ListPageVersionsInput,
): Promise<PageVersion[]> {
  return deps.pageVersionRepository.listByPage(input.tenantId, input.pageId);
}
