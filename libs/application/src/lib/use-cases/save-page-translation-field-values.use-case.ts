import { randomUUID } from 'node:crypto';
import {
  PageTranslation,
  PageTranslationDivergedError,
  PageTranslationNotFoundError,
} from '@brisk/domain-core';
import type { FieldValueOverlay } from '@brisk/shared-types';
import type { PageTranslationRepositoryPort } from '@brisk/ports';

export interface SavePageTranslationFieldValuesDeps {
  pageTranslationRepository: PageTranslationRepositoryPort;
}

export interface SavePageTranslationFieldValuesInput {
  tenantId: string;
  pageTranslationId: string;
  fieldValues: FieldValueOverlay;
  parentGroupId: string | null;
  actorUserId: string | null;
}

/**
 * Saves the per-locale text overlay — mirrors saveDraft's versioning
 * discipline (one PageTranslationVersion row per save). A diverged
 * translation ignores `fieldValues` entirely (see PageTranslation.
 * saveFieldValues's own doc comment), so writing here would silently do
 * nothing from the caller's point of view — rejected instead, the caller
 * must use the diverged-content path (Fase 3).
 */
export async function savePageTranslationFieldValues(
  deps: SavePageTranslationFieldValuesDeps,
  input: SavePageTranslationFieldValuesInput,
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

  translation.saveFieldValues(input.fieldValues);
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
    input.parentGroupId,
  );

  return translation;
}
