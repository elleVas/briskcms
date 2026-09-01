import { PageGroupReorderMismatchError } from '@brisk/domain-core';
import type { PageGroupRepositoryPort } from '@brisk/ports';

export interface ReorderSiblingPageGroupsDeps {
  pageGroupRepository: PageGroupRepositoryPort;
}

export interface ReorderSiblingPageGroupsInput {
  tenantId: string;
  siteId: string;
  parentId: string | null;
  /** The full sibling group, id-only, in the desired new order (drag-and-drop hands this back as one complete list on drop). */
  orderedPageGroupIds: string[];
}

/**
 * Mirrors the old reorderSiblingPages — same all-or-nothing permutation
 * discipline (see that use-case's own history for why), scoped by
 * `parentId` only, not `(locale, parentId)`: a PageGroup's position in the
 * hierarchy is shared across every one of its translations now, there's
 * no separate per-locale sibling group to keep in sync (that was the
 * whole point of the rewrite).
 */
export async function reorderSiblingPageGroups(
  deps: ReorderSiblingPageGroupsDeps,
  input: ReorderSiblingPageGroupsInput,
): Promise<void> {
  const siblings = await deps.pageGroupRepository.listSiblings(
    input.tenantId,
    input.siteId,
    input.parentId,
  );
  const actualIds = new Set(siblings.map((sibling) => sibling.id));
  const providedIds = new Set(input.orderedPageGroupIds);
  const isExactPermutation =
    actualIds.size === providedIds.size &&
    input.orderedPageGroupIds.length === providedIds.size &&
    [...actualIds].every((id) => providedIds.has(id));
  if (!isExactPermutation) {
    throw new PageGroupReorderMismatchError();
  }

  for (const [index, pageGroupId] of input.orderedPageGroupIds.entries()) {
    const group = await deps.pageGroupRepository.findById(
      input.tenantId,
      pageGroupId,
    );
    // Already validated as a member of `siblings` above — this can only be
    // null under a real race (deleted between the read and here), in which
    // case there's nothing left to reorder.
    if (!group) continue;
    group.reorder(index);
    await deps.pageGroupRepository.save(group);
  }
}
