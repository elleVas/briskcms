import type { Media } from '@brisk/domain-core';
import type { PaginatedResult, Pagination } from './pagination';

/**
 * Every method requires tenantId explicitly: no query can "forget" its
 * per-tenant scoping at the Port's signature level, even though the
 * concrete adapter also relies on RLS as a second barrier.
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
