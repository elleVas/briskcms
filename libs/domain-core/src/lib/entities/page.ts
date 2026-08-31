import type { PageContent, SeoMeta } from '@brisk/shared-types';

export type PageStatus = 'draft' | 'published';

export interface PageProps {
  id: string;
  tenantId: string;
  siteId: string;
  groupId: string;
  locale: string;
  slug: string;
  parentId: string | null;
  status: PageStatus;
  content: PageContent;
  publishedContent: PageContent | null;
  seoMeta: SeoMeta;
  /** See PageRecord's own field doc (libs/shared-types/page-record.ts) — same meaning. */
  syncedStructureSignature: string | null;
  /** Sibling-scoped position (see setPageOrder's own comment) — unique only within (tenantId, siteId, locale, parentId), not site-wide. */
  order: number;
  /** The user who created this page, or null if they've since been deleted (FK is ON DELETE SET NULL) or the page predates this column. Set once at creation, never changed afterward. */
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePageProps {
  id: string;
  tenantId: string;
  siteId: string;
  groupId: string;
  locale: string;
  slug: string;
  parentId?: string | null;
  seoMeta: SeoMeta;
  content?: PageContent;
  syncedStructureSignature?: string | null;
  /** Computed by the caller (create-page use-case) from the target sibling group's current max — defaults to 0 for a lone/first sibling. */
  order?: number;
  createdBy?: string | null;
  now?: Date;
}

/**
 * Entità pura: nessuna dipendenza da Postgres/Express/Puck. Incapsula le
 * transizioni draft -> published e il rollback, cosi che gli invarianti
 * (es. published_content si aggiorna solo via publish()) non dipendano
 * da chi la chiama.
 */
export class Page {
  private constructor(private props: PageProps) {}

  static create(input: CreatePageProps): Page {
    const now = input.now ?? new Date();
    return new Page({
      id: input.id,
      tenantId: input.tenantId,
      siteId: input.siteId,
      groupId: input.groupId,
      locale: input.locale,
      slug: input.slug,
      parentId: input.parentId ?? null,
      status: 'draft',
      content: input.content ?? [],
      publishedContent: null,
      seoMeta: input.seoMeta,
      syncedStructureSignature: input.syncedStructureSignature ?? null,
      order: input.order ?? 0,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: PageProps): Page {
    return new Page({ ...props });
  }

  toProps(): PageProps {
    return { ...this.props };
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get siteId(): string {
    return this.props.siteId;
  }

  get groupId(): string {
    return this.props.groupId;
  }

  get locale(): string {
    return this.props.locale;
  }

  get slug(): string {
    return this.props.slug;
  }

  get parentId(): string | null {
    return this.props.parentId;
  }

  get status(): PageStatus {
    return this.props.status;
  }

  get content(): PageContent {
    return this.props.content;
  }

  get publishedContent(): PageContent | null {
    return this.props.publishedContent;
  }

  get seoMeta(): SeoMeta {
    return this.props.seoMeta;
  }

  get syncedStructureSignature(): string | null {
    return this.props.syncedStructureSignature;
  }

  get order(): number {
    return this.props.order;
  }

  get createdBy(): string | null {
    return this.props.createdBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Riassegna il genitore nella gerarchia pagine. Operazione separata da
   * draft/publish (come SiteLayoutSection.setSticky()): è una posizione
   * nell'albero, non contenuto — prende effetto subito, nessuna riga di
   * versione. Convalida del ciclo/stesso sito+lingua a carico del
   * use-case (setPageParent), che ha accesso al repository; l'entità pura
   * non può risalire la catena da sola.
   */
  setParent(parentId: string | null, now: Date = new Date()): void {
    this.props.parentId = parentId;
    this.props.updatedAt = now;
  }

  /**
   * Reassigns this page's position among its siblings (drag-to-reorder in
   * the pages list). Same reasoning as setParent: a position in the tree,
   * not content — takes effect immediately, no version row. Validating that
   * the new value actually reflects a real permutation of the sibling group
   * is the reorderSiblingPages use-case's job (it has repository access);
   * the pure entity just stores whatever value it's given.
   */
  reorder(order: number, now: Date = new Date()): void {
    this.props.order = order;
    this.props.updatedAt = now;
  }

  /** Aggiorna il draft. Non tocca la versione pubblicata. */
  saveDraft(content: PageContent, now: Date = new Date()): void {
    this.props.content = content;
    this.props.updatedAt = now;
  }

  /**
   * Dichiara questa traduzione allineata alla struttura corrente della
   * pagina nella lingua predefinita del sito (l'admin l'ha rivista dopo un
   * avviso di drift, o l'accetta così com'è). Non tocca `content`/
   * `updatedAt`: è solo metadato di sincronizzazione, non una modifica
   * reale alla pagina.
   */
  markStructureSynced(signature: string): void {
    this.props.syncedStructureSignature = signature;
  }

  /**
   * Aggiorna i metadati SEO, indipendentemente da draft/pubblicazione
   * (vedi ADR-0014: non è block content, non passa dal formato dati di
   * Puck né dal versioning di page_versions, che traccia solo `content`).
   */
  updateSeoMeta(seoMeta: SeoMeta, now: Date = new Date()): void {
    this.props.seoMeta = seoMeta;
    this.props.updatedAt = now;
  }

  /** Promuove il draft corrente a versione pubblicata. */
  publish(now: Date = new Date()): void {
    this.props.publishedContent = this.props.content;
    this.props.status = 'published';
    this.props.updatedAt = now;
  }

  /**
   * Ripristina il draft al contenuto di una versione precedente. Non
   * ripubblica automaticamente: il contenuto pubblicato resta quello
   * dell'ultima publish() esplicita, coerente con "mai overwrite
   * distruttivo" — l'editor rivede il rollback prima di ripubblicare.
   */
  restoreContent(content: PageContent, now: Date = new Date()): void {
    this.props.content = content;
    this.props.updatedAt = now;
  }
}
