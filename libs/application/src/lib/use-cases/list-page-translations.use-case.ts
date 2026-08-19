import { PageNotFoundError, type Page } from '@brisk/domain-core';
import type { PageRepositoryPort } from '@brisk/ports';

export interface ListPageTranslationsDeps {
  pageRepository: PageRepositoryPort;
}

export interface ListPageTranslationsInput {
  tenantId: string;
  pageId: string;
}

/** Every page in the same group as `pageId` (docs/adr/0017), including `pageId` itself. */
export async function listPageTranslations(
  deps: ListPageTranslationsDeps,
  input: ListPageTranslationsInput,
): Promise<Page[]> {
  const page = await deps.pageRepository.findById(input.tenantId, input.pageId);
  if (!page) {
    throw new PageNotFoundError(input.pageId);
  }

  return deps.pageRepository.listByGroup(
    input.tenantId,
    page.siteId,
    page.groupId,
  );
}
