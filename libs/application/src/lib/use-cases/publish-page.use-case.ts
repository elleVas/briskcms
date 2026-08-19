import { Page, PageNotFoundError } from '@brisk/domain-core';
import type { PageRepositoryPort, SearchPort } from '@brisk/ports';

export interface PublishPageDeps {
  pageRepository: PageRepositoryPort;
  searchPort: SearchPort;
}

export interface PublishPageInput {
  tenantId: string;
  pageId: string;
}

export async function publishPage(
  deps: PublishPageDeps,
  input: PublishPageInput,
): Promise<Page> {
  const page = await deps.pageRepository.findById(input.tenantId, input.pageId);
  if (!page) {
    throw new PageNotFoundError(input.pageId);
  }

  page.publish();
  await deps.pageRepository.save(page);
  await deps.searchPort.indexPage(input.tenantId, page.siteId, page);

  return page;
}
