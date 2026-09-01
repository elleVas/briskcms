import type { PageContent } from '@brisk/shared-types';

export interface PageGroupProps {
  id: string;
  tenantId: string;
  siteId: string;
  /** Gerarchia CONDIVISA tra tutte le lingue di questo gruppo — a differenza della vecchia `Page.parentId` (per-locale), non ha senso che due lingue della stessa pagina vivano in punti diversi dell'albero del sito. */
  parentId: string | null;
  /** Posizione tra fratelli, condivisa per lo stesso motivo di `parentId` — vedi setPageOrder's own comment sul vecchio modello. */
  order: number;
  /** L'albero blocchi canonico. Per un campo marcato `translatable` (vedi FieldDescriptor in @brisk/block-registry), il valore qui è quello della lingua di default del sito — fallback quando una PageTranslation non ha ancora un proprio override (vedi mergeTranslatedContent). */
  content: PageContent;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePageGroupProps {
  id: string;
  tenantId: string;
  siteId: string;
  parentId?: string | null;
  content?: PageContent;
  order?: number;
  createdBy?: string | null;
  now?: Date;
}

/**
 * Entità pura, stesso stile di Page (di cui questa e PageTranslation
 * prendono il posto — vedi ADR-0017's superamento). Possiede la struttura
 * CONDIVISA tra tutte le lingue: aggiungere/rimuovere/riordinare un blocco
 * qui vale per ogni PageTranslation collegata (non "scollegata", vedi
 * PageTranslation.isDiverged) in un colpo solo — questo è l'intero punto
 * del redesign i18n a livello di campo, elimina il drift strutturale che
 * il vecchio modello poteva solo segnalare, mai prevenire.
 */
export class PageGroup {
  private constructor(private props: PageGroupProps) {}

  static create(input: CreatePageGroupProps): PageGroup {
    const now = input.now ?? new Date();
    return new PageGroup({
      id: input.id,
      tenantId: input.tenantId,
      siteId: input.siteId,
      parentId: input.parentId ?? null,
      order: input.order ?? 0,
      content: input.content ?? [],
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: PageGroupProps): PageGroup {
    return new PageGroup({ ...props });
  }

  toProps(): PageGroupProps {
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

  get parentId(): string | null {
    return this.props.parentId;
  }

  get order(): number {
    return this.props.order;
  }

  get content(): PageContent {
    return this.props.content;
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

  /** Riassegna il genitore nella gerarchia — stessa disciplina di Page.setParent: convalida ciclo/stesso sito a carico del use-case (ha accesso al repository), l'entità pura non può risalire la catena da sola. */
  setParent(parentId: string | null, now: Date = new Date()): void {
    this.props.parentId = parentId;
    this.props.updatedAt = now;
  }

  /** Riassegna la posizione tra fratelli — stessa disciplina di Page.reorder: la validità della permutazione è del use-case, non dell'entità. */
  reorder(order: number, now: Date = new Date()): void {
    this.props.order = order;
    this.props.updatedAt = now;
  }

  /** Aggiorna la struttura condivisa (draft) — propaga a tutte le PageTranslation collegate, mai a quelle scollegate (vedi PageTranslation.isDiverged). */
  saveContent(content: PageContent, now: Date = new Date()): void {
    this.props.content = content;
    this.props.updatedAt = now;
  }
}
