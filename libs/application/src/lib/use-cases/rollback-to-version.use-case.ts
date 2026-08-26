import { randomUUID } from 'node:crypto';
import {
  Page,
  PageNotFoundError,
  PageVersionNotFoundError,
} from '@brisk/domain-core';
import type {
  PageRepositoryPort,
  PageVersionRepositoryPort,
} from '@brisk/ports';

export interface RollbackToVersionDeps {
  pageRepository: PageRepositoryPort;
  pageVersionRepository: PageVersionRepositoryPort;
}

export interface RollbackToVersionInput {
  tenantId: string;
  pageId: string;
  versionId: string;
  actorUserId: string | null;
}

/**
 * Ripristina il draft al contenuto di una versione precedente e registra
 * a sua volta il rollback come nuova versione (mai un overwrite distruttivo).
 * Non ripubblica: vedi Page.restoreContent().
 */
export async function rollbackToVersion(
  deps: RollbackToVersionDeps,
  input: RollbackToVersionInput,
): Promise<Page> {
  const page = await deps.pageRepository.findById(input.tenantId, input.pageId);
  if (!page) {
    throw new PageNotFoundError(input.pageId);
  }

  const version = await deps.pageVersionRepository.findById(
    input.tenantId,
    input.versionId,
  );
  if (!version || version.pageId !== page.id) {
    throw new PageVersionNotFoundError(input.versionId);
  }

  page.restoreContent(version.content);
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
