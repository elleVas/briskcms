import { randomUUID } from 'node:crypto';
import {
  PageGroupNotFoundError,
  PageSlugAlreadyExistsError,
  PageTranslation,
  PageTranslationLocaleAlreadyExistsError,
} from '@brisk/domain-core';
import type { SeoMeta } from '@brisk/shared-types';
import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
  TaxonomyRepositoryPort,
} from '@brisk/ports';
import { assertPageSlugFreeOfTerms } from './term-address';

export interface CreatePageGroupTranslationDeps {
  pageGroupRepository: PageGroupRepositoryPort;
  pageTranslationRepository: PageTranslationRepositoryPort;
  /**
   * Only to ask whether a taxonomy or one of its root-mounted terms
   * already answers at this address (docs/adr/0064) — the third of the
   * three places that rule has to hold, and the only one on the page
   * side.
   */
  taxonomyRepository: TaxonomyRepositoryPort;
}

export interface CreatePageGroupTranslationInput {
  tenantId: string;
  pageGroupId: string;
  locale: string;
  slug: string;
  seoMeta: SeoMeta;
  createdBy: string | null;
}

/**
 * Adds one locale to an existing group — deliberately lightweight
 * (`fieldValues: {}`, no full content copy) compared to the old
 * createPageTranslation: the structure isn't this translation's to own
 * anymore, it lives on PageGroup and is inherited automatically.
 */
export async function createPageGroupTranslation(
  deps: CreatePageGroupTranslationDeps,
  input: CreatePageGroupTranslationInput,
): Promise<PageTranslation> {
  const group = await deps.pageGroupRepository.findById(
    input.tenantId,
    input.pageGroupId,
  );
  if (!group) {
    throw new PageGroupNotFoundError(input.pageGroupId);
  }

  const existing = await deps.pageTranslationRepository.findByGroupAndLocale(
    input.tenantId,
    input.pageGroupId,
    input.locale,
  );
  if (existing) {
    throw new PageTranslationLocaleAlreadyExistsError(input.locale);
  }

  const slugTaken =
    await deps.pageTranslationRepository.findByParentGroupAndLocaleSlug(
      input.tenantId,
      group.siteId,
      input.locale,
      group.parentId,
      input.slug,
    );
  if (slugTaken) {
    throw new PageSlugAlreadyExistsError(input.slug);
  }

  // Only at the root: a nested page's address begins with its ancestors'
  // slugs, and no term can be there — a taxonomy prefix is refused as a
  // root page slug in the first place, so nothing can own that first
  // segment except a page.
  if (group.parentId === null) {
    await assertPageSlugFreeOfTerms(
      {
        taxonomyRepository: deps.taxonomyRepository,
        pageTranslationRepository: deps.pageTranslationRepository,
      },
      {
        tenantId: input.tenantId,
        siteId: group.siteId,
        locale: input.locale,
        slug: input.slug,
      },
    );
  }

  const translation = PageTranslation.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    siteId: group.siteId,
    pageGroupId: group.id,
    locale: input.locale,
    slug: input.slug,
    seoMeta: input.seoMeta,
    createdBy: input.createdBy,
  });

  await deps.pageTranslationRepository.save(translation, group.parentId);

  return translation;
}
