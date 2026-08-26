import { randomUUID } from 'node:crypto';
import { Page, PageNotFoundError } from '@brisk/domain-core';
import type { PageContent } from '@brisk/shared-types';
import type { PageRepositoryPort } from '@brisk/ports';

export interface SaveDraftDeps {
  pageRepository: PageRepositoryPort;
}

export interface SaveDraftInput {
  tenantId: string;
  pageId: string;
  content: PageContent;
  actorUserId: string | null;
}

export async function saveDraft(
  deps: SaveDraftDeps,
  input: SaveDraftInput,
): Promise<Page> {
  const page = await deps.pageRepository.findById(input.tenantId, input.pageId);
  if (!page) {
    throw new PageNotFoundError(input.pageId);
  }

  page.saveDraft(input.content);
  await deps.pageRepository.saveWithVersion(page, {
    id: randomUUID(),
    tenantId: page.tenantId,
    pageId: page.id,
    content: page.content,
    createdBy: input.actorUserId,
    createdAt: page.updatedAt,
  });

  return page;
}
