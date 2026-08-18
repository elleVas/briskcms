import type { Media } from '@brisk/domain-core';
import type { PaginatedResult, Pagination } from './page-repository.port.js';

/**
 * Ogni metodo richiede esplicitamente tenantId: nessuna query può
 * "dimenticare" lo scoping per tenant a livello di firma del Port,
 * anche se l'adapter concreto si affida anche a RLS come seconda barriera.
 */
export interface MediaRepositoryPort {
  save(media: Media): Promise<void>;
  findById(tenantId: string, mediaId: string): Promise<Media | null>;
  listBySite(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<Media>>;
  delete(tenantId: string, mediaId: string): Promise<void>;
}
