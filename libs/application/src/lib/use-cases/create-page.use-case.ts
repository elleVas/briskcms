import { randomUUID } from 'node:crypto';
import { Page, PageSlugAlreadyExistsError } from '@brisk/domain-core';
import type { PageContent, SeoMeta } from '@brisk/shared-types';
import type {
  PageRepositoryPort,
  PageVersionRepositoryPort,
} from '@brisk/ports';

export interface CreatePageDeps {
  pageRepository: PageRepositoryPort;
  pageVersionRepository: PageVersionRepositoryPort;
}

export interface CreatePageInput {
  tenantId: string;
  siteId: string;
  groupId: string;
  locale: string;
  slug: string;
  seoMeta: SeoMeta;
  content?: PageContent;
  createdBy: string | null;
}

export async function createPage(
  deps: CreatePageDeps,
  input: CreatePageInput,
): Promise<Page> {
  const existing = await deps.pageRepository.findBySlug(
    input.tenantId,
    input.siteId,
    input.locale,
    input.slug,
  );
  if (existing) {
    throw new PageSlugAlreadyExistsError(input.slug);
  }

  const page = Page.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    siteId: input.siteId,
    groupId: input.groupId,
    locale: input.locale,
    slug: input.slug,
    seoMeta: input.seoMeta,
    content: input.content,
  });

  await deps.pageRepository.save(page);
  await deps.pageVersionRepository.save({
    id: randomUUID(),
    tenantId: page.tenantId,
    pageId: page.id,
    content: page.content,
    createdBy: input.createdBy,
    createdAt: page.updatedAt,
  });

  return page;
}
