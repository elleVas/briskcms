import { PageNotFoundError, type Page } from '@brisk/domain-core';
import type { PageRepositoryPort } from '@brisk/ports';

export interface GetPageBySlugDeps {
  pageRepository: PageRepositoryPort;
}

export interface GetPageBySlugInput {
  tenantId: string;
  siteId: string;
  locale: string;
  /** Sibling-scoped (WP-style): omit/null for a root-level page — see schema.ts's `pages` unique constraints. */
  parentId?: string | null;
  slug: string;
}

/** Same reasoning as getPageById — the authenticated CRUD read path, not the public one (getPublishedPageBySlug). */
export async function getPageBySlug(
  deps: GetPageBySlugDeps,
  input: GetPageBySlugInput,
): Promise<Page> {
  const page = await deps.pageRepository.findByParentAndSlug(
    input.tenantId,
    input.siteId,
    input.locale,
    input.parentId ?? null,
    input.slug,
  );
  if (!page) {
    throw new PageNotFoundError(
      `${input.siteId}/${input.locale}/${input.slug}`,
    );
  }
  return page;
}
