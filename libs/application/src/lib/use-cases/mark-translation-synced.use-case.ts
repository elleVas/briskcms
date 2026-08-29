import { PageNotFoundError } from '@brisk/domain-core';
import type { PageRepositoryPort } from '@brisk/ports';

export interface MarkTranslationSyncedDeps {
  pageRepository: PageRepositoryPort;
}

export interface MarkTranslationSyncedInput {
  tenantId: string;
  pageId: string;
  structureSignature: string;
}

/**
 * The manual half of the translation structural-drift indicator (see
 * content-structure-signature.ts): an admin reviewed this translation
 * against its group's current default-locale structure and confirms it's
 * fine as-is — either they just finished updating it, or it's
 * deliberately different for this locale. `structureSignature` is the
 * default-locale page's CURRENT signature, computed by the caller
 * (editor-app already has that sibling's content loaded from the same
 * `GET /pages/:id/translations` response the drift badge itself is
 * computed from) — this use-case doesn't re-derive it, so it can't
 * silently disagree with what the admin was actually looking at.
 */
export async function markTranslationSynced(
  deps: MarkTranslationSyncedDeps,
  input: MarkTranslationSyncedInput,
) {
  const page = await deps.pageRepository.findById(input.tenantId, input.pageId);
  if (!page) {
    throw new PageNotFoundError(input.pageId);
  }

  page.markStructureSynced(input.structureSignature);
  await deps.pageRepository.save(page);

  return page;
}
