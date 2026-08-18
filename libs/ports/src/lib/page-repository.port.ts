import type { Page } from '@brisk/domain-core';

export interface Pagination {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

/**
 * Ogni metodo richiede esplicitamente tenantId: nessuna query può
 * "dimenticare" lo scoping per tenant a livello di firma del Port,
 * anche se l'adapter concreto si affida anche a RLS come seconda barriera.
 */
export interface PageRepositoryPort {
  save(page: Page): Promise<void>;
  findById(tenantId: string, pageId: string): Promise<Page | null>;
  findBySlug(
    tenantId: string,
    siteId: string,
    locale: string,
    slug: string,
  ): Promise<Page | null>;
  listBySite(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<Page>>;
  delete(tenantId: string, pageId: string): Promise<void>;
}
