import type { Page, PageStatus, PageVersion } from '@brisk/domain-core';
import type { SeoMeta } from '@brisk/shared-types';

export interface Pagination {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

/**
 * Security review 2026-08-24, database section: `listBySite` used to
 * return full `Page` entities — `content`/`publishedContent` (the entire
 * Puck block tree) shipped with every row of a page LIST, when the list UI
 * only ever needs id/slug/title/status/updatedAt (see
 * pages-list-view.tsx). `hasUnpublishedChanges` replaces the raw
 * content-vs-publishedContent comparison the list UI used to do
 * client-side with both full trees already in hand — computed once in SQL
 * instead (`content IS DISTINCT FROM published_content`), so neither tree
 * ever leaves Postgres for a list request.
 */
export interface PageSummary {
  id: string;
  tenantId: string;
  siteId: string;
  groupId: string;
  locale: string;
  slug: string;
  parentId: string | null;
  status: PageStatus;
  seoMeta: SeoMeta;
  order: number;
  /**
   * Resolved at query time (users.displayName, falling back to users.email
   * — same fallback the rest of the app uses), not the raw user id: this
   * projection is display-only, same reasoning as hasUnpublishedChanges
   * above. Null when the page predates the createdBy column, or its
   * creator has since been deleted.
   */
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  hasUnpublishedChanges: boolean;
}

/**
 * Ogni metodo richiede esplicitamente tenantId: nessuna query può
 * "dimenticare" lo scoping per tenant a livello di firma del Port,
 * anche se l'adapter concreto si affida anche a RLS come seconda barriera.
 */
export interface PageRepositoryPort {
  save(page: Page): Promise<void>;
  /**
   * Salva la pagina e la sua nuova versione nella STESSA transazione — mai
   * due `save()` separati (uno su `PageRepositoryPort`, uno su
   * `PageVersionRepositoryPort`): se il secondo fallisse dopo che il primo è
   * già committato, la pagina risulterebbe salvata senza che esista alcuna
   * versione storica, rompendo silenziosamente cronologia e rollback nel
   * percorso più usato del prodotto (ogni salvataggio di draft).
   */
  saveWithVersion(page: Page, version: PageVersion): Promise<void>;
  findById(tenantId: string, pageId: string): Promise<Page | null>;
  /**
   * Sibling-scoped (WP-style): `slug` is only unique within `parentId`
   * (`null` = root-level), not site-wide — see schema.ts's own comment on
   * `pages`' unique constraints. The public URL resolver walks a path
   * segment-by-segment with this method (start at `parentId: null`, feed
   * each match's own `id` as the next segment's `parentId`), rather than
   * looking up the trailing slug alone.
   */
  findByParentAndSlug(
    tenantId: string,
    siteId: string,
    locale: string,
    parentId: string | null,
    slug: string,
  ): Promise<Page | null>;
  listBySite(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<PageSummary>>;
  /** Every locale-translation of the same page (Fase 5b) — `groupId` links them, see schema.ts's own comment on the column. */
  listByGroup(
    tenantId: string,
    siteId: string,
    groupId: string,
  ): Promise<Page[]>;
  /**
   * The literal sibling group `order` is scoped to — same (parentId, null
   * = root-level) semantics as findByParentAndSlug. Ordered by `order`
   * ascending (createdAt as a tiebreak for rows sharing the same value,
   * e.g. every page created before this column existed defaults to 0).
   * Used both to compute a new page's initial order (append at the end)
   * and to validate a reorder request is an exact permutation of the real
   * group, not a mechanism for listing children generically.
   */
  listSiblings(
    tenantId: string,
    siteId: string,
    locale: string,
    parentId: string | null,
  ): Promise<PageSummary[]>;
  delete(tenantId: string, pageId: string): Promise<void>;
}
