import { randomUUID } from 'node:crypto';
import {
  Page,
  PageNotFoundError,
  PageSlugAlreadyExistsError,
  PageTranslationAlreadyExistsError,
} from '@brisk/domain-core';
import type { PageRepositoryPort } from '@brisk/ports';

export interface CreatePageTranslationDeps {
  pageRepository: PageRepositoryPort;
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

  // Inherit the source page's position in the hierarchy when possible —
  // same "copy from source, don't start blank" principle as content/SEO
  // above. If the parent has no translation in the target locale yet, the
  // new translation is created at the root rather than blocking creation
  // (same graceful-degradation precedent as untranslatedPageFallback).
  // Resolved before the slug check below: slug uniqueness is scoped to
  // THIS parent, so the check needs the real parentId, not a guess.
  let parentId: string | null = null;
  if (source.parentId) {
    const parent = await deps.pageRepository.findById(
      input.tenantId,
      source.parentId,
    );
    if (parent) {
      const parentSiblings = await deps.pageRepository.listByGroup(
        input.tenantId,
        source.siteId,
        parent.groupId,
      );
      parentId =
        parentSiblings.find((sibling) => sibling.locale === input.locale)?.id ??
        null;
    }
  }

  const slugTaken = await deps.pageRepository.findByParentAndSlug(
    input.tenantId,
    source.siteId,
    input.locale,
    parentId,
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
    parentId,
    seoMeta: source.seoMeta,
    content: source.content,
  });

  await deps.pageRepository.saveWithVersion(translation, {
    id: randomUUID(),
    tenantId: translation.tenantId,
    pageId: translation.id,
    content: translation.content,
    createdBy: input.createdBy,
    createdAt: translation.updatedAt,
  });

  return translation;
}
