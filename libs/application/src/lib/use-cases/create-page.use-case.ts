import { randomUUID } from 'node:crypto';
import { Page, PageSlugAlreadyExistsError } from '@brisk/domain-core';
import type { PageContent, SeoMeta } from '@brisk/shared-types';
import type { PageRepositoryPort } from '@brisk/ports';

export interface CreatePageDeps {
  pageRepository: PageRepositoryPort;
}

export interface CreatePageInput {
  tenantId: string;
  siteId: string;
  groupId: string;
  locale: string;
  slug: string;
  parentId?: string | null;
  seoMeta: SeoMeta;
  content?: PageContent;
  createdBy: string | null;
}

export async function createPage(
  deps: CreatePageDeps,
  input: CreatePageInput,
): Promise<Page> {
  const existing = await deps.pageRepository.findByParentAndSlug(
    input.tenantId,
    input.siteId,
    input.locale,
    input.parentId ?? null,
    input.slug,
  );
  if (existing) {
    throw new PageSlugAlreadyExistsError(input.slug);
  }

  // Appends at the end of the real sibling group (drag-to-reorder, see
  // reorderSiblingPages) — Math.max over an empty array is -Infinity, not
  // a sensible "no siblings yet" default, hence the explicit -1 seed.
  const siblings = await deps.pageRepository.listSiblings(
    input.tenantId,
    input.siteId,
    input.locale,
    input.parentId ?? null,
  );
  const order = Math.max(-1, ...siblings.map((sibling) => sibling.order)) + 1;

  const page = Page.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    siteId: input.siteId,
    groupId: input.groupId,
    locale: input.locale,
    slug: input.slug,
    parentId: input.parentId,
    seoMeta: input.seoMeta,
    content: input.content,
    order,
    createdBy: input.createdBy,
  });

  await deps.pageRepository.saveWithVersion(page, {
    id: randomUUID(),
    tenantId: page.tenantId,
    pageId: page.id,
    content: page.content,
    createdBy: input.createdBy,
    createdAt: page.updatedAt,
  });

  return page;
}
