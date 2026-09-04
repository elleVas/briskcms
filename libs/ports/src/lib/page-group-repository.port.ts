import type { PageGroup, PageGroupVersion } from '@brisk/domain-core';
import type { Pagination, PaginatedResult } from './pagination';

/**
 * A list projection — the same reason as PageSummary (security review
 * 2026-08-24): never ship `content` (the whole block tree) for a list row.
 * No `createdByName` or language-availability badge here: that richer
 * projection is phase 4's job (rebuilding the pages list), which will
 * extend this port when it arrives — keeping it minimal now avoids
 * designing a shape in advance that might change.
 */
export interface PageGroupSummary {
  id: string;
  tenantId: string;
  siteId: string;
  parentId: string | null;
  order: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** One PageTranslation, projected down to exactly what a list row's locale badge (and title) needs — see PageGroupListItem. */
export interface PageGroupListItemTranslation {
  locale: string;
  slug: string;
  /** seoMeta.title — the row's own display title comes from whichever translation matches the site's default locale (see PageGroupsListView's groupDisplayTitle). */
  title: string;
  status: 'draft' | 'published';
  isDiverged: boolean;
}

/**
 * Fase 4's richer list projection (see PageGroupSummary's own doc comment,
 * which named this exact extension point) — one row per PageGroup, with
 * `createdByName` resolved server-side (same reasoning as PageSummary,
 * security review 2026-08-24: never make the client resolve a raw user
 * id) and every locale's translation summarized for the row's
 * availability badges (published/draft/diverged/missing).
 */
export interface PageGroupListItem {
  id: string;
  tenantId: string;
  siteId: string;
  parentId: string | null;
  order: number;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  translations: PageGroupListItemTranslation[];
}

/** All optional — an absent filter means "don't filter on this dimension." */
export interface PageGroupListFilters {
  /** Case-insensitive substring match against any of the group's translations' seoMeta.title. */
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  createdBy?: string;
  /** Groups that have a translation (any status) in this locale. */
  locale?: string;
}

/**
 * Owns the SHARED structure and the position in the hierarchy — it takes
 * the place of the old Page's "structure" half (see
 * PageTranslationRepositoryPort for the "per-locale text" half). The same
 * explicit tenantId scoping discipline as PageRepositoryPort.
 */
export interface PageGroupRepositoryPort {
  save(group: PageGroup): Promise<void>;
  /** The same atomic transaction as PageRepositoryPort.saveWithVersion, for the same reason: never a structure saved without its matching version row. */
  saveWithVersion(group: PageGroup, version: PageGroupVersion): Promise<void>;
  findById(tenantId: string, pageGroupId: string): Promise<PageGroup | null>;
  listBySite(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<PageGroupSummary>>;
  /** Fase 4's pages-list view — filtered + the richer PageGroupListItem projection, distinct from listBySite (still used unfiltered by the sitemap/nav-tree use-cases). */
  listBySiteFiltered(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
    filters: PageGroupListFilters,
  ): Promise<PaginatedResult<PageGroupListItem>>;
  /** Siblings in the SHARED hierarchy — it replaces PageRepositoryPort.listSiblings, now with no need for a `locale` parameter (a position in the tree is no longer per-locale). */
  listSiblings(
    tenantId: string,
    siteId: string,
    parentId: string | null,
  ): Promise<PageGroupSummary[]>;
  /** Deletes the group AND every one of its PageTranslations (ON DELETE CASCADE, see schema.ts) — a group with no translations has no reason to exist. */
  delete(tenantId: string, pageGroupId: string): Promise<void>;
}
