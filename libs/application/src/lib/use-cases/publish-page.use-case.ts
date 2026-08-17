import { Page, PageNotFoundError } from '@brisk/domain-core';
import type { PageRepositoryPort } from '@brisk/ports';

export interface PublishPageDeps {
  pageRepository: PageRepositoryPort;
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

  return page;
}
