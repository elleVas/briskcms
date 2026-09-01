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
   * `parentGroupId` è il `PageGroup.parentId` CORRENTE — il chiamante lo
   * possiede già (ha appena letto o riparentato il gruppo) e lo passa
   * esplicitamente ad ogni scrittura, invece che l'adapter lo rilegga da
   * solo con un secondo giro DB. Denormalizzato sulla riga (vedi
   * schema.ts) solo per rendere possibile il vincolo di unicità dello
   * slug sibling-scoped a livello DB — un valore diverso da quello vero
   * del gruppo la prossima volta che qualcuno riparenta il gruppo senza
   * ri-salvare ogni sua traduzione romperebbe silenziosamente quel
   * vincolo, per questo è un parametro esplicito e non un dettaglio
   * interno dell'adapter.
   */
  save(
    translation: PageTranslation,
    parentGroupId: string | null,
  ): Promise<void>;
  /** Stessa transazione atomica di PageRepositoryPort.saveWithVersion. Non valida per una traduzione appena scollegata che salva `divergedContent`: quello passa da PageGroupVersion (stessa forma, vedi PageTranslationVersion's doc comment). */
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
  /** Ogni lingua dello stesso gruppo — sostituisce PageRepositoryPort.listByGroup. */
  listByGroup(
    tenantId: string,
    pageGroupId: string,
  ): Promise<PageTranslation[]>;
  /**
   * Sostituisce PageRepositoryPort.findByParentAndSlug per la risoluzione
   * pubblica — cammina la gerarchia CONDIVISA (PageGroup.parentId) un
   * segmento alla volta, risolvendo lo slug tradotto di ogni livello nella
   * `locale` richiesta (join page_groups + page_translations lato
   * adapter). `parentGroupId: null` = livello radice, stessa semantica di
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
