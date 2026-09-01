import type { PageGroup, PageGroupVersion } from '@brisk/domain-core';
import type { Pagination, PaginatedResult } from './pagination';

/**
 * Proiezione lista — stessa ragione di PageSummary (security review
 * 2026-08-24): mai spedire `content` (l'intero albero blocchi) per una
 * riga di lista. Niente `createdByName`/badge-disponibilità-lingua qui:
 * quella proiezione più ricca è compito della Fase 4 (ricostruzione della
 * lista pagine), che estenderà questo port quando arriva — tenerlo
 * minimale ora evita di progettare in anticipo una forma che potrebbe
 * cambiare.
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
 * Possiede la struttura CONDIVISA e la posizione nella gerarchia — prende
 * il posto della parte "struttura" della vecchia Page (vedi
 * PageTranslationRepositoryPort per la parte "testo per-locale"). Stessa
 * disciplina di scoping esplicito per tenantId di PageRepositoryPort.
 */
export interface PageGroupRepositoryPort {
  save(group: PageGroup): Promise<void>;
  /** Stessa transazione atomica di PageRepositoryPort.saveWithVersion, stessa ragione: mai una struttura salvata senza la sua riga di versione corrispondente. */
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
  /** Fratelli nella gerarchia CONDIVISA — sostituisce PageRepositoryPort.listSiblings, ora senza bisogno di un parametro `locale` (la posizione nell'albero non è più per-locale). */
  listSiblings(
    tenantId: string,
    siteId: string,
    parentId: string | null,
  ): Promise<PageGroupSummary[]>;
  /** Cancella il gruppo E ogni sua PageTranslation (ON DELETE CASCADE, vedi schema.ts) — un gruppo senza traduzioni non ha motivo di esistere. */
  delete(tenantId: string, pageGroupId: string): Promise<void>;
}
