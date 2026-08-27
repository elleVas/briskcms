import { PageNotFoundError, type Page } from '@brisk/domain-core';
import type { PageRepositoryPort } from '@brisk/ports';

export interface GetPageBySlugDeps {
  pageRepository: PageRepositoryPort;
}

export interface GetPageBySlugInput {
  tenantId: string;
  siteId: string;
  locale: string;
  slug: string;
}

/** Same reasoning as getPageById — the authenticated CRUD read path, not the public one (getPublishedPageBySlug). */
export async function getPageBySlug(
  deps: GetPageBySlugDeps,
  input: GetPageBySlugInput,
): Promise<Page> {
  const page = await deps.pageRepository.findBySlug(
    input.tenantId,
    input.siteId,
    input.locale,
    input.slug,
  );
  if (!page) {
    throw new PageNotFoundError(
      `${input.siteId}/${input.locale}/${input.slug}`,
    );
  }
  return page;
}
