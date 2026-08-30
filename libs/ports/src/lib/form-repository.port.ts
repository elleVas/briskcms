import type { Form } from '@brisk/domain-core';
import type { PaginatedResult, Pagination } from './page-repository.port';

/**
 * Ogni metodo richiede esplicitamente tenantId: nessuna query può
 * "dimenticare" lo scoping per tenant a livello di firma del Port,
 * anche se l'adapter concreto si affida anche a RLS come seconda barriera.
 */
export interface FormRepositoryPort {
  save(form: Form): Promise<void>;
  findById(tenantId: string, formId: string): Promise<Form | null>;
  listBySite(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<Form>>;
  delete(tenantId: string, formId: string): Promise<void>;
}
