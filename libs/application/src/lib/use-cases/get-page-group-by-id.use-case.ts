import { PageGroupNotFoundError, type PageGroup } from '@brisk/domain-core';
import type { PageGroupRepositoryPort } from '@brisk/ports';

export interface GetPageGroupByIdDeps {
  pageGroupRepository: PageGroupRepositoryPort;
}

export interface GetPageGroupByIdInput {
  tenantId: string;
  pageGroupId: string;
}

export async function getPageGroupById(
  deps: GetPageGroupByIdDeps,
  input: GetPageGroupByIdInput,
): Promise<PageGroup> {
  const group = await deps.pageGroupRepository.findById(
    input.tenantId,
    input.pageGroupId,
  );
  if (!group) {
    throw new PageGroupNotFoundError(input.pageGroupId);
  }
  return group;
}
