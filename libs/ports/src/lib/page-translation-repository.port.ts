import type {
  PageTranslation,
  PageTranslationVersion,
} from '@brisk/domain-core';

/**
 * Possiede il testo per-locale (overlay di campi traducibili, slug,
 * seoMeta, stato di pubblicazione) — prende il posto della parte
 * "per-locale" della vecchia Page (vedi PageGroupRepositoryPort per la
 * parte "struttura condivisa"). Stessa disciplina di scoping esplicito
 * per tenantId di PageRepositoryPort.
 */
export interface PageTranslationRepositoryPort {
  /**
   * `parentGroupId` is the CURRENT `PageGroup.parentId` — the caller
   * already owns it (having just read or reparented the group) and passes
   * it explicitly on every write, rather than the adapter reading it back
   * itself with a second DB round-trip. It is denormalized onto the row
   * (see schema.ts) purely to make the sibling-scoped slug uniqueness
   * constraint possible at the DB level — a value differing from the
   * group's real one, the next time someone reparents the group without
   * re-saving every translation, would silently break that constraint,
   * which is why it is an explicit parameter rather than an adapter
   * internal.
   */
  save(
    translation: PageTranslation,
    parentGroupId: string | null,
  ): Promise<void>;
  /** The same atomic transaction as PageRepositoryPort.saveWithVersion. Not valid for a just-unlinked translation saving `divergedContent`: that goes through PageGroupVersion (the same shape, see PageTranslationVersion's doc comment). */
  saveWithVersion(
    translation: PageTranslation,
    version: PageTranslationVersion,
    parentGroupId: string | null,
  ): Promise<void>;
  findById(
    tenantId: string,
    pageTranslationId: string,
  ): Promise<PageTranslation | null>;
  findByGroupAndLocale(
    tenantId: string,
    pageGroupId: string,
    locale: string,
  ): Promise<PageTranslation | null>;
  /** Every language of the same group — it replaces PageRepositoryPort.listByGroup. */
  listByGroup(
    tenantId: string,
    pageGroupId: string,
  ): Promise<PageTranslation[]>;
  /**
   * Replaces PageRepositoryPort.findByParentAndSlug for public resolution —
   * it walks the SHARED hierarchy (PageGroup.parentId) one segment at a
   * time, resolving each level's translated slug in the requested `locale`
   * (a page_groups + page_translations join on the adapter side).
   * `parentGroupId: null` = the root level, the same semantics as
   * `findByParentAndSlug`'s `parentId: null`.
   */
  findByParentGroupAndLocaleSlug(
    tenantId: string,
    siteId: string,
    locale: string,
    parentGroupId: string | null,
    slug: string,
  ): Promise<PageTranslation | null>;
  delete(tenantId: string, pageTranslationId: string): Promise<void>;
}
