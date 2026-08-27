import { PageNotFoundError, type Page } from '@brisk/domain-core';
import type { PageRepositoryPort } from '@brisk/ports';

export interface GetPageByIdDeps {
  pageRepository: PageRepositoryPort;
}

export interface GetPageByIdInput {
  tenantId: string;
  pageId: string;
}

/**
 * Security review 2026-08-24, backend seconda passata: PagesController
 * chiamava pageRepository.findById direttamente dal controller (in 2
 * punti — GET /pages/:id e POST /pages/:id/preview-token), l'unico
 * bypass del layer applicativo tra gli endpoint di questo controller —
 * create/update/list passano tutti da uno use-case. Un solo posto da
 * cui deriva anche la traduzione PageNotFoundError -> 404 (la mappa
 * globale in domain-error-http-mapping.ts), invece del NotFoundException
 * costruito a mano nel controller.
 */
export async function getPageById(
  deps: GetPageByIdDeps,
  input: GetPageByIdInput,
): Promise<Page> {
  const page = await deps.pageRepository.findById(input.tenantId, input.pageId);
  if (!page) {
    throw new PageNotFoundError(input.pageId);
  }
  return page;
}
