import { randomUUID } from 'node:crypto';
import {
  Page,
  PageNotFoundError,
  PageSlugAlreadyExistsError,
  PageTranslationAlreadyExistsError,
} from '@brisk/domain-core';
import type {
  PageRepositoryPort,
  PageVersionRepositoryPort,
} from '@brisk/ports';

export interface CreatePageTranslationDeps {
  pageRepository: PageRepositoryPort;
  pageVersionRepository: PageVersionRepositoryPort;
}

export interface CreatePageTranslationInput {
  tenantId: string;
  sourcePageId: string;
  locale: string;
  slug: string;
  createdBy: string | null;
}

/**
 * Creates a new page in the same group (docs/adr/0017 — Fase 5b) as
 * `sourcePageId`, copying its current draft content and SEO meta as a
 * starting point to translate in place, rather than starting blank —
 * confirmed with the user, matches how WPML/Polylang do it.
 */
export async function createPageTranslation(
  deps: CreatePageTranslationDeps,
  input: CreatePageTranslationInput,
): Promise<Page> {
  const source = await deps.pageRepository.findById(
    input.tenantId,
    input.sourcePageId,
  );
  if (!source) {
    throw new PageNotFoundError(input.sourcePageId);
  }

  const siblings = await deps.pageRepository.listByGroup(
    input.tenantId,
    source.siteId,
    source.groupId,
  );
  if (siblings.some((sibling) => sibling.locale === input.locale)) {
    throw new PageTranslationAlreadyExistsError(input.locale);
  }

  const slugTaken = await deps.pageRepository.findBySlug(
    input.tenantId,
    source.siteId,
    input.locale,
    input.slug,
  );
  if (slugTaken) {
    throw new PageSlugAlreadyExistsError(input.slug);
  }

  const translation = Page.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    siteId: source.siteId,
    groupId: source.groupId,
    locale: input.locale,
    slug: input.slug,
    seoMeta: source.seoMeta,
    content: source.content,
  });

  await deps.pageRepository.save(translation);
  await deps.pageVersionRepository.save({
    id: randomUUID(),
    tenantId: translation.tenantId,
    pageId: translation.id,
    content: translation.content,
    createdBy: input.createdBy,
    createdAt: translation.updatedAt,
  });

  return translation;
}
