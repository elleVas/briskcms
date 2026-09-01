import { randomUUID } from 'node:crypto';
import { PageGroup, PageGroupNotFoundError } from '@brisk/domain-core';
import type { PageContent } from '@brisk/shared-types';
import type { PageGroupRepositoryPort } from '@brisk/ports';

export interface SavePageGroupContentDeps {
  pageGroupRepository: PageGroupRepositoryPort;
}

export interface SavePageGroupContentInput {
  tenantId: string;
  pageGroupId: string;
  content: PageContent;
  actorUserId: string | null;
}

/**
 * Saves the shared draft structure — propagates to every linked
 * PageTranslation (not diverged ones, see PageTranslation.isDiverged)
 * without those translations needing their own write. Mirrors saveDraft's
 * versioning discipline (one PageGroupVersion row per save).
 */
export async function savePageGroupContent(
  deps: SavePageGroupContentDeps,
  input: SavePageGroupContentInput,
): Promise<PageGroup> {
  const group = await deps.pageGroupRepository.findById(
    input.tenantId,
    input.pageGroupId,
  );
  if (!group) {
    throw new PageGroupNotFoundError(input.pageGroupId);
  }

  group.saveContent(input.content);
  await deps.pageGroupRepository.saveWithVersion(group, {
    id: randomUUID(),
    tenantId: group.tenantId,
    pageGroupId: group.id,
    content: group.content,
    createdBy: input.actorUserId,
    createdAt: group.updatedAt,
  });

  return group;
}
