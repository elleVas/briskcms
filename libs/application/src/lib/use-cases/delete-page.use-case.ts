import { PageNotFoundError } from '@brisk/domain-core';
import type { PageRepositoryPort } from '@brisk/ports';

export interface DeletePageDeps {
  pageRepository: PageRepositoryPort;
}

export interface DeletePageInput {
  tenantId: string;
  pageId: string;
}

export async function deletePage(
  deps: DeletePageDeps,
  input: DeletePageInput,
): Promise<void> {
  const page = await deps.pageRepository.findById(input.tenantId, input.pageId);
  if (!page) {
    throw new PageNotFoundError(input.pageId);
  }

  await deps.pageRepository.delete(input.tenantId, input.pageId);
}
