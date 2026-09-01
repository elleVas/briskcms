import type { PageTranslation } from '@brisk/domain-core';

export interface PageSearchResult {
  pageId: string;
  slug: string;
  title: string;
  excerpt: string;
}

/**
 * Deliberately its own Port, not a method on PageTranslationRepositoryPort:
 * search is a distinct capability with its own storage/query shape (a
 * Postgres adapter today uses `tsvector`/GIN, a different engine — MariaDB
 * FULLTEXT, SQLite FTS5, MongoDB $text — would need none of
 * PageTranslationRepositoryPort's CRUD surface to implement it). Keeping the
 * two Ports separate means a future non-Postgres deployment can swap only
 * the search adapter without touching page persistence, or vice versa.
 */
export interface SearchPort {
  /**
   * (Re)indexes a translation's current searchable text — called after a
   * translation is published. Idempotent: re-indexing an already-indexed
   * translation just overwrites its entry. No separate `removeFromIndex`:
   * the index lives on the translation's own row in every adapter this
   * Port is expected to have (see PostgresSearchRepository), so deleting
   * the translation already removes it — a translation that was never
   * published is simply never indexed and never matches a search.
   */
  indexPage(
    tenantId: string,
    siteId: string,
    translation: PageTranslation,
  ): Promise<void>;

  /** Only ever matches published translations — an adapter must never surface draft content here. */
  search(
    tenantId: string,
    siteId: string,
    locale: string,
    query: string,
  ): Promise<PageSearchResult[]>;
}
