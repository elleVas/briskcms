import { randomUUID } from 'node:crypto';
import { PageGroup } from '@brisk/domain-core';
import type { PageContent } from '@brisk/shared-types';
import type { PageGroupRepositoryPort } from '@brisk/ports';

export interface CreatePageGroupDeps {
  pageGroupRepository: PageGroupRepositoryPort;
}

export interface CreatePageGroupInput {
  tenantId: string;
  siteId: string;
  parentId?: string | null;
  content?: PageContent;
  createdBy: string | null;
}

/**
 * Creates only the shared structure (see createPageGroup vs.
 * createPageGroupTranslation in the i18n plan) — a group with zero
 * translations is a valid intermediate state, the caller adds at least one
 * locale next.
 */
export async function createPageGroup(
  deps: CreatePageGroupDeps,
  input: CreatePageGroupInput,
): Promise<PageGroup> {
  // Same -1 seed as createPage: Math.max over an empty sibling array is
  // -Infinity, not a sensible "no siblings yet" default.
  const siblings = await deps.pageGroupRepository.listSiblings(
    input.tenantId,
    input.siteId,
    input.parentId ?? null,
  );
  const order = Math.max(-1, ...siblings.map((sibling) => sibling.order)) + 1;

  const group = PageGroup.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    siteId: input.siteId,
    parentId: input.parentId,
    content: input.content,
    order,
    createdBy: input.createdBy,
  });

  await deps.pageGroupRepository.saveWithVersion(group, {
    id: randomUUID(),
    tenantId: group.tenantId,
    pageGroupId: group.id,
    content: group.content,
    createdBy: input.createdBy,
    createdAt: group.updatedAt,
  });

  return group;
}
