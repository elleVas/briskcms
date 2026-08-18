import { PageNotFoundError, type Page } from '@brisk/domain-core';
import type { SeoMeta } from '@brisk/shared-types';
import type { PageRepositoryPort } from '@brisk/ports';

export interface UpdateSeoMetaDeps {
  pageRepository: PageRepositoryPort;
}

export interface UpdateSeoMetaInput {
  tenantId: string;
  pageId: string;
  seoMeta: SeoMeta;
}

export async function updateSeoMeta(
  deps: UpdateSeoMetaDeps,
  input: UpdateSeoMetaInput,
): Promise<Page> {
  const page = await deps.pageRepository.findById(input.tenantId, input.pageId);
  if (!page) {
    throw new PageNotFoundError(input.pageId);
  }

  page.updateSeoMeta(input.seoMeta);
  await deps.pageRepository.save(page);

  return page;
}
