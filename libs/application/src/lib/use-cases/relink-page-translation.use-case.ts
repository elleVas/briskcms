import { randomUUID } from 'node:crypto';
import {
  PageGroupNotFoundError,
  PageTranslationNotDivergedError,
  PageTranslationNotFoundError,
  type PageTranslation,
} from '@brisk/domain-core';
import type { FieldValueOverlay } from '@brisk/shared-types';
import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
} from '@brisk/ports';

export interface RelinkPageTranslationDeps {
  pageGroupRepository: PageGroupRepositoryPort;
  pageTranslationRepository: PageTranslationRepositoryPort;
}

export interface RelinkPageTranslationInput {
  tenantId: string;
  pageTranslationId: string;
  /** The fork's text as an overlay on the shared structure — `relinkedOverlay` in @brisk/shared-types, computed by the caller. */
  fieldValues: FieldValueOverlay;
  actorUserId: string | null;
}

/**
 * Brings an unlinked language back onto the shared structure
 * (docs/adr/0075), with the fork's text as its translation.
 *
 * The overlay arrives computed rather than computed here: which fields
 * carry over depends on which ones each block declares translatable, and
 * only the editor knows that for every block — a running API knows the
 * core registry and not a theme's (see sanitize-page-content.ts). The
 * editor already needs it anyway, to say how many blocks relinking would
 * drop before anyone confirms.
 *
 * Nothing is lost for good: the fork being let go is the translation's
 * newest version — every change to it is versioned — so restoring that
 * version unlinks the language again with it.
 */
export async function relinkPageTranslation(
  deps: RelinkPageTranslationDeps,
  input: RelinkPageTranslationInput,
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

  const group = await deps.pageGroupRepository.findById(
    input.tenantId,
    translation.pageGroupId,
  );
  if (!group) {
    throw new PageGroupNotFoundError(translation.pageGroupId);
  }

  translation.relink(input.fieldValues, { by: input.actorUserId });
  await deps.pageTranslationRepository.saveWithVersion(
    translation,
    translation.toVersion(randomUUID()),
    group.parentId,
  );

  return translation;
}
