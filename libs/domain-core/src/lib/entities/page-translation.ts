import type {
  FieldValueOverlay,
  PageContent,
  SeoMeta,
} from '@brisk/shared-types';

export type PageTranslationStatus = 'draft' | 'published';

export interface PageTranslationProps {
  id: string;
  tenantId: string;
  /** Denormalizzato dal PageGroup, scritto solo alla creazione — una pagina non cambia mai sito. Serve al vincolo di unicità dello slug e alla risoluzione pubblica senza un join, vedi PageTranslationRepositoryPort.findByParentGroupAndLocaleSlug. */
  siteId: string;
  pageGroupId: string;
  locale: string;
  /** Resta per-locale: URL tradotti, a differenza della struttura ora condivisa su PageGroup. */
  slug: string;
  seoMeta: SeoMeta;
  /** Override di SOLI campi `translatable`, chiavati per blocco — vedi mergeTranslatedContent. Ignorato quando `isDiverged` è true (una traduzione scollegata ha la propria struttura+testo interamente in `divergedContent`). */
  fieldValues: FieldValueOverlay;
  /** Pubblicazione resta PER-LOCALE, come nel vecchio modello — si può pubblicare una lingua oggi e un'altra quando è pronta. */
  status: PageTranslationStatus;
  /** Merge congelato (struttura di PageGroup + fieldValues di questa lingua, o `divergedContent` se scollegata) al momento dell'ultima publish() — stessa forma di Page.publishedContent di ieri, stesso consumatore (risoluzione pubblica). */
  publishedSnapshot: PageContent | null;
  /** Lo "scollega": quando true, questa traduzione non riceve più le modifiche strutturali propagate da PageGroup.content — ha una propria struttura+testo indipendente in `divergedContent`, esattamente il comportamento del vecchio modello isolato a questa sola lingua. */
  isDiverged: boolean;
  /** Popolato solo quando `isDiverged` è true — fork completo al momento della divergenza. `null` finché la traduzione resta collegata. */
  divergedContent: PageContent | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePageTranslationProps {
  id: string;
  tenantId: string;
  siteId: string;
  pageGroupId: string;
  locale: string;
  slug: string;
  seoMeta: SeoMeta;
  fieldValues?: FieldValueOverlay;
  createdBy?: string | null;
  now?: Date;
}

/**
 * Entità pura, prende il posto della vecchia Page per-locale (con
 * PageGroup). A differenza di ieri, creare una traduzione è leggero —
 * `fieldValues: {}`, nessuna copia integrale della struttura — perché la
 * struttura non le appartiene più, vive su PageGroup.
 */
export class PageTranslation {
  private constructor(private props: PageTranslationProps) {}

  static create(input: CreatePageTranslationProps): PageTranslation {
    const now = input.now ?? new Date();
    return new PageTranslation({
      id: input.id,
      tenantId: input.tenantId,
      siteId: input.siteId,
      pageGroupId: input.pageGroupId,
      locale: input.locale,
      slug: input.slug,
      seoMeta: input.seoMeta,
      fieldValues: input.fieldValues ?? {},
      status: 'draft',
      publishedSnapshot: null,
      isDiverged: false,
      divergedContent: null,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: PageTranslationProps): PageTranslation {
    return new PageTranslation({ ...props });
  }

  toProps(): PageTranslationProps {
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

  get pageGroupId(): string {
    return this.props.pageGroupId;
  }

  get locale(): string {
    return this.props.locale;
  }

  get slug(): string {
    return this.props.slug;
  }

  get seoMeta(): SeoMeta {
    return this.props.seoMeta;
  }

  get fieldValues(): FieldValueOverlay {
    return this.props.fieldValues;
  }

  get status(): PageTranslationStatus {
    return this.props.status;
  }

  get publishedSnapshot(): PageContent | null {
    return this.props.publishedSnapshot;
  }

  get isDiverged(): boolean {
    return this.props.isDiverged;
  }

  get divergedContent(): PageContent | null {
    return this.props.divergedContent;
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

  /** Aggiorna slug/seoMeta — resta per-locale come ieri, indipendente da draft/pubblicazione della struttura (stessa ragione di Page.updateSeoMeta, ADR-0014). */
  updateSeoMeta(seoMeta: SeoMeta, now: Date = new Date()): void {
    this.props.seoMeta = seoMeta;
    this.props.updatedAt = now;
  }

  updateSlug(slug: string, now: Date = new Date()): void {
    this.props.slug = slug;
    this.props.updatedAt = now;
  }

  /** Salva l'overlay di testo per questa lingua — NON valido su una traduzione scollegata (il use-case deve verificare `isDiverged` prima di chiamare, l'entità pura non ha accesso al descrittore campi per saperlo da sola). */
  saveFieldValues(
    fieldValues: FieldValueOverlay,
    now: Date = new Date(),
  ): void {
    this.props.fieldValues = fieldValues;
    this.props.updatedAt = now;
  }

  /** Promuove il merge corrente (calcolato dal chiamante — mergeTranslatedContent(group.content, this.fieldValues), o `divergedContent` se scollegata) a versione pubblicata di questa lingua. */
  publish(mergedContent: PageContent, now: Date = new Date()): void {
    this.props.publishedSnapshot = mergedContent;
    this.props.status = 'published';
    this.props.updatedAt = now;
  }

  /**
   * Scollega questa traduzione dalla struttura condivisa — fork completo:
   * `currentMergedContent` (calcolato dal chiamante, stesso merge di
   * publish()) diventa la nuova, indipendente `divergedContent`. Dopo
   * questa chiamata, le modifiche strutturali su PageGroup.content non
   * raggiungono più questa traduzione — usa `saveDivergedContent` per le
   * modifiche successive, non più `saveFieldValues`. Irreversibile in v1
   * (nessun "ricollega" — vedi il piano, ambiguo quali modifiche
   * vincerebbero).
   */
  diverge(currentMergedContent: PageContent, now: Date = new Date()): void {
    this.props.isDiverged = true;
    this.props.divergedContent = currentMergedContent;
    this.props.updatedAt = now;
  }

  /** Aggiorna il contenuto indipendente di una traduzione GIÀ scollegata — il use-case deve verificare `isDiverged` prima di chiamare, stessa disciplina di saveFieldValues. */
  saveDivergedContent(content: PageContent, now: Date = new Date()): void {
    this.props.divergedContent = content;
    this.props.updatedAt = now;
  }
}
