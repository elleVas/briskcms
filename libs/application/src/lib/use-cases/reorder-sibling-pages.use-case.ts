import { PageReorderMismatchError } from '@brisk/domain-core';
import type { PageRepositoryPort } from '@brisk/ports';

export interface ReorderSiblingPagesDeps {
  pageRepository: PageRepositoryPort;
}

export interface ReorderSiblingPagesInput {
  tenantId: string;
  siteId: string;
  locale: string;
  parentId: string | null;
  /** The full sibling group, id-only, in the desired new order (drag-and-drop hands this back as one complete list on drop). */
  orderedPageIds: string[];
}

/**
 * A separate use-case from setPageParent on purpose, same "structural
 * setting, not content" reasoning: a sibling's position takes effect
 * immediately, no draft/publish staging, no page_versions row.
 *
 * `orderedPageIds` must be an exact permutation of the real current
 * sibling group — not a partial reorder, not a list that references a
 * page from a different group. Rejecting anything else here (rather than
 * silently reordering only the ids that do match) keeps this an
 * all-or-nothing move, so a stale client (someone else deleted/reparented
 * a sibling since the list was fetched) fails loudly instead of writing an
 * order that doesn't reflect reality.
 */
export async function reorderSiblingPages(
  deps: ReorderSiblingPagesDeps,
  input: ReorderSiblingPagesInput,
): Promise<void> {
  const siblings = await deps.pageRepository.listSiblings(
    input.tenantId,
    input.siteId,
    input.locale,
    input.parentId,
  );
  const actualIds = new Set(siblings.map((sibling) => sibling.id));
  const providedIds = new Set(input.orderedPageIds);
  const isExactPermutation =
    actualIds.size === providedIds.size &&
    input.orderedPageIds.length === providedIds.size &&
    [...actualIds].every((id) => providedIds.has(id));
  if (!isExactPermutation) {
    throw new PageReorderMismatchError();
  }

  for (const [index, pageId] of input.orderedPageIds.entries()) {
    const page = await deps.pageRepository.findById(input.tenantId, pageId);
    // Already validated as a member of `siblings` above — this can only be
    // null under a real race (deleted between the read and here), in which
    // case there's nothing left to reorder.
    if (!page) continue;
    page.reorder(index);
    await deps.pageRepository.save(page);
  }
}
