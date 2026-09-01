import { randomUUID } from 'node:crypto';
import {
  PageGroupNotFoundError,
  PageTranslationDivergedError,
  PageTranslationNotFoundError,
  type PageTranslation,
} from '@brisk/domain-core';
import { mergeTranslatedContent } from '@brisk/shared-types';
import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
} from '@brisk/ports';

export interface DivergePageTranslationDeps {
  pageGroupRepository: PageGroupRepositoryPort;
  pageTranslationRepository: PageTranslationRepositoryPort;
}

export interface DivergePageTranslationInput {
  tenantId: string;
  pageTranslationId: string;
  actorUserId: string | null;
}

/**
 * The "scollega" action — forks the current merge (group structure + this
 * locale's fieldValues) into a standalone `divergedContent`. Irreversible
 * in v1 (no re-link, see the plan) — after this, structural edits to
 * PageGroup.content no longer reach this translation.
 */
export async function divergePageTranslation(
  deps: DivergePageTranslationDeps,
  input: DivergePageTranslationInput,
): Promise<PageTranslation> {
  const translation = await deps.pageTranslationRepository.findById(
    input.tenantId,
    input.pageTranslationId,
  );
  if (!translation) {
    throw new PageTranslationNotFoundError(input.pageTranslationId);
  }
  if (translation.isDiverged) {
    throw new PageTranslationDivergedError(translation.id);
  }

  const group = await deps.pageGroupRepository.findById(
    input.tenantId,
    translation.pageGroupId,
  );
  if (!group) {
    throw new PageGroupNotFoundError(translation.pageGroupId);
  }

  const merged = mergeTranslatedContent(group.content, translation.fieldValues);
  translation.diverge(merged);

  await deps.pageTranslationRepository.saveWithVersion(
    translation,
    {
      id: randomUUID(),
      tenantId: translation.tenantId,
      pageTranslationId: translation.id,
      fieldValues: translation.fieldValues,
      seoMeta: translation.seoMeta,
      createdBy: input.actorUserId,
      createdAt: translation.updatedAt,
    },
    group.parentId,
  );

  return translation;
}
