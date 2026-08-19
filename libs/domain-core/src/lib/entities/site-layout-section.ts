import type { PageContent } from '@brisk/shared-types';

export type SiteLayoutSectionKind = 'header' | 'footer';
export type SiteLayoutSectionStatus = 'draft' | 'published';

export interface SiteLayoutSectionProps {
  id: string;
  tenantId: string;
  siteId: string;
  locale: string;
  kind: SiteLayoutSectionKind;
  status: SiteLayoutSectionStatus;
  content: PageContent;
  publishedContent: PageContent | null;
  // Ha senso solo per kind='header' (resta ancorato in cima durante lo
  // scroll) — nessun vincolo a livello di dominio che lo impedisca per
  // 'footer', semplicemente l'editor-app non espone il controllo lì e
  // apps/public-site non lo legge mai per il footer. Non è parte del
  // versioning (site-layout-section-version.ts resta solo content): è
  // un'impostazione di visualizzazione, non un contenuto pubblicato.
  sticky: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSiteLayoutSectionProps {
  id: string;
  tenantId: string;
  siteId: string;
  locale: string;
  kind: SiteLayoutSectionKind;
  // Punto di partenza copiato dal content dell'header/footer già
  // pubblicato nella locale di default del sito (docs/adr/0018) — stessa
  // filosofia "copy-on-translate" di createPageTranslation, così abilitare
  // una nuova lingua non costringe a ricostruire l'header da zero. `sticky`
  // segue la stessa logica: se l'header IT è sticky, l'header EN appena
  // creato per copia parte sticky anche lui.
  content?: PageContent;
  sticky?: boolean;
  now?: Date;
}

/**
 * Entità pura, nessuna dipendenza da Postgres/Express/Puck. A differenza
 * di Page non ha `groupId`/`slug`/`seoMeta`: Header/Footer non hanno una
 * URL pubblica propria, vivono a livello di (tenant, sito, locale, kind),
 * non come pagine visitabili (docs/adr/0018).
 */
export class SiteLayoutSection {
  private constructor(private props: SiteLayoutSectionProps) {}

  static create(input: CreateSiteLayoutSectionProps): SiteLayoutSection {
    const now = input.now ?? new Date();
    return new SiteLayoutSection({
      id: input.id,
      tenantId: input.tenantId,
      siteId: input.siteId,
      locale: input.locale,
      kind: input.kind,
      status: 'draft',
      content: input.content ?? [],
      publishedContent: null,
      sticky: input.sticky ?? false,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: SiteLayoutSectionProps): SiteLayoutSection {
    return new SiteLayoutSection({ ...props });
  }

  toProps(): SiteLayoutSectionProps {
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

  get locale(): string {
    return this.props.locale;
  }

  get kind(): SiteLayoutSectionKind {
    return this.props.kind;
  }

  get status(): SiteLayoutSectionStatus {
    return this.props.status;
  }

  get content(): PageContent {
    return this.props.content;
  }

  get publishedContent(): PageContent | null {
    return this.props.publishedContent;
  }

  get sticky(): boolean {
    return this.props.sticky;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Aggiorna il draft. Non tocca la versione pubblicata. */
  saveDraft(content: PageContent, now: Date = new Date()): void {
    this.props.content = content;
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
   * ripubblica automaticamente, stesso invariante di Page.restoreContent.
   */
  restoreContent(content: PageContent, now: Date = new Date()): void {
    this.props.content = content;
    this.props.updatedAt = now;
  }

  /**
   * Non è "content": non passa dal draft/publish, non genera una riga di
   * versione (è un'impostazione di visualizzazione, non testo/blocchi che
   * un editor vorrebbe poter ripristinare) — prende effetto subito, anche
   * se lo status resta 'draft'.
   */
  setSticky(sticky: boolean, now: Date = new Date()): void {
    this.props.sticky = sticky;
    this.props.updatedAt = now;
  }
}
