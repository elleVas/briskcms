import { PageGroupNotFoundError } from '@brisk/domain-core';
import type { PageGroupRepositoryPort } from '@brisk/ports';

export interface DeletePageGroupDeps {
  pageGroupRepository: PageGroupRepositoryPort;
}

export interface DeletePageGroupInput {
  tenantId: string;
  pageGroupId: string;
}

/** Cascades to every PageTranslation of the group (ON DELETE CASCADE, see schema.ts) — a group can't be deleted "partially". */
export async function deletePageGroup(
  deps: DeletePageGroupDeps,
  input: DeletePageGroupInput,
): Promise<void> {
  const group = await deps.pageGroupRepository.findById(
    input.tenantId,
    input.pageGroupId,
  );
  if (!group) {
    throw new PageGroupNotFoundError(input.pageGroupId);
  }

  await deps.pageGroupRepository.delete(input.tenantId, input.pageGroupId);
}
