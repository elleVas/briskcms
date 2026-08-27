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
  ): Promise<PaginatedResult<PageSummary>>;
  /** Every locale-translation of the same page (Fase 5b) — `groupId` links them, see schema.ts's own comment on the column. */
  listByGroup(
    tenantId: string,
    siteId: string,
    groupId: string,
  ): Promise<Page[]>;
  delete(tenantId: string, pageId: string): Promise<void>;
}
