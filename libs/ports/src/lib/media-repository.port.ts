import type { Media, MediaKind } from '@brisk/domain-core';
import type { PaginatedResult, Pagination } from './pagination';

/**
 * What to narrow a site's library down to.
 *
 * Both parts are optional and both are answered by the database, not by
 * the caller: the library is paginated, so filtering the page that came
 * back would be a search that only ever looked at the newest twenty-four
 * files — and said nothing about the rest.
 */
export interface MediaFilter {
  /** Matched against the filename, case-insensitively, anywhere in it. */
  search?: string;
  /** Images, video or audio — decided from the stored MIME type's own prefix. */
  kind?: MediaKind;
}

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
    filter?: MediaFilter,
  ): Promise<PaginatedResult<Media>>;
  delete(tenantId: string, mediaId: string): Promise<void>;
}
