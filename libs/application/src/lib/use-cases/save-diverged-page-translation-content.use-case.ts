import {
  PageTranslationNotDivergedError,
  PageTranslationNotFoundError,
  type PageTranslation,
} from '@brisk/domain-core';
import type { PageContent } from '@brisk/shared-types';
import type { PageTranslationRepositoryPort } from '@brisk/ports';

export interface SaveDivergedPageTranslationContentDeps {
  pageTranslationRepository: PageTranslationRepositoryPort;
}

export interface SaveDivergedPageTranslationContentInput {
  tenantId: string;
  pageTranslationId: string;
  content: PageContent;
  parentGroupId: string | null;
}

/**
 * Saves a diverged translation's own, independent structure — the
 * counterpart to savePageGroupContent for a translation that has forked
 * away from the shared PageGroup.content (see PageTranslation.diverge).
 * Plain save, no version row: unlike savePageGroupContent/
 * savePageTranslationFieldValues, there is no versions table scoped to a
 * translation's own content today (page_group_versions' FK points at
 * PageGroup, not PageTranslation) — diverging is a real but rare escape
 * hatch (see the plan), version history for it is a known, deliberately
 * deferred gap, not an oversight.
 */
export async function saveDivergedPageTranslationContent(
  deps: SaveDivergedPageTranslationContentDeps,
  input: SaveDivergedPageTranslationContentInput,
): Promise<PageTranslation> {
  const translation = await deps.pageTranslationRepository.findById(
    input.tenantId,
    input.pageTranslationId,
  );
  if (!translation) {
    throw new PageTranslationNotFoundError(input.pageTranslationId);
  }
  if (!translation.isDiverged) {
    throw new PageTranslationNotDivergedError(translation.id);
  }

  translation.saveDivergedContent(input.content);
  await deps.pageTranslationRepository.save(translation, input.parentGroupId);

  return translation;
}
