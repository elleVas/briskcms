import { randomUUID } from 'node:crypto';
import { Page, PageNotFoundError } from '@brisk/domain-core';
import type { PageContent } from '@brisk/shared-types';
import type {
  PageRepositoryPort,
  PageVersionRepositoryPort,
} from '@brisk/ports';

export interface SaveDraftDeps {
  pageRepository: PageRepositoryPort;
  pageVersionRepository: PageVersionRepositoryPort;
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
  await deps.pageRepository.save(page);
  await deps.pageVersionRepository.save({
    id: randomUUID(),
    tenantId: page.tenantId,
    pageId: page.id,
    content: page.content,
    createdBy: input.actorUserId,
    createdAt: page.updatedAt,
  });

  return page;
}
