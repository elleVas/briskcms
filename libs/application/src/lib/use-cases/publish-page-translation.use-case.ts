import {
  PageGroupNotFoundError,
  PageTranslationNotFoundError,
  type PageTranslation,
} from '@brisk/domain-core';
import { mergeTranslatedContent, type PageContent } from '@brisk/shared-types';
import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
  SearchPort,
} from '@brisk/ports';

export interface PublishPageTranslationDeps {
  pageGroupRepository: PageGroupRepositoryPort;
  pageTranslationRepository: PageTranslationRepositoryPort;
  searchPort: SearchPort;
}

export interface PublishPageTranslationInput {
  tenantId: string;
  pageTranslationId: string;
}

/**
 * Freezes this locale's current draft (group structure + fieldValues, or
 * divergedContent when isDiverged) as `publishedSnapshot` — same shape as
 * the old Page.publishedContent, same consumer (public resolution, Fase 2).
 * Also (re)indexes the translation for search — same point in the old
 * publishPage's lifecycle (see publishPage's own history), just against
 * SearchPort's PageTranslation-shaped indexPage (Fase 5).
 */
export async function publishPageTranslation(
  deps: PublishPageTranslationDeps,
  input: PublishPageTranslationInput,
): Promise<PageTranslation> {
  const translation = await deps.pageTranslationRepository.findById(
    input.tenantId,
    input.pageTranslationId,
  );
  if (!translation) {
    throw new PageTranslationNotFoundError(input.pageTranslationId);
  }

  const group = await deps.pageGroupRepository.findById(
    input.tenantId,
    translation.pageGroupId,
  );
  if (!group) {
    throw new PageGroupNotFoundError(translation.pageGroupId);
  }

  let merged: PageContent;
  if (translation.isDiverged) {
    // diverge() always sets divergedContent in the same call that sets
    // isDiverged — a diverged translation with no divergedContent means
    // the row is corrupted, not a case to silently fall back from.
    if (!translation.divergedContent) {
      throw new Error(
        `Page translation ${translation.id} is diverged but has no divergedContent`,
      );
    }
    merged = translation.divergedContent;
  } else {
    merged = mergeTranslatedContent(group.content, translation.fieldValues);
  }

  translation.publish(merged);
  await deps.pageTranslationRepository.save(translation, group.parentId);
  await deps.searchPort.indexPage(
    input.tenantId,
    translation.siteId,
    translation,
  );

  return translation;
}
