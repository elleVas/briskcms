import type {
  FieldValueOverlay,
  PageContent,
  SeoMeta,
} from '@brisk/shared-types';
import type { EditContext } from './edit-context';

export type PageTranslationStatus = 'draft' | 'published';

export interface PageTranslationProps {
  id: string;
  tenantId: string;
  /** Denormalized from the PageGroup, written only at creation — a page never changes site. Needed for the slug uniqueness constraint and for public resolution without a join, see PageTranslationRepositoryPort.findByParentGroupAndLocaleSlug. */
  siteId: string;
  pageGroupId: string;
  locale: string;
  /** Resta per-locale: URL tradotti, a differenza della struttura ora condivisa su PageGroup. */
  slug: string;
  /** Every address this translation answered to before its current one, oldest first — see `updateSlug`. */
  formerSlugs: string[];
  seoMeta: SeoMeta;
  /** Override di SOLI campi `translatable`, chiavati per blocco — vedi mergeTranslatedContent. Ignorato quando `isDiverged` è true (una traduzione scollegata ha la propria struttura+testo interamente in `divergedContent`). */
  fieldValues: FieldValueOverlay;
  /** Publishing stays PER-LOCALE, as in the old model — one language can be published today and another when it is ready. */
  status: PageTranslationStatus;
  /** The frozen merge (the PageGroup's structure plus this language's fieldValues, or `divergedContent` when unlinked) as of the last publish() — the same shape as yesterday's Page.publishedContent, and the same consumer (public resolution). */
  publishedSnapshot: PageContent | null;
  /** "Unlinks" it: when true, this translation no longer receives the structural changes propagated from PageGroup.content — it has a structure and text of its own in `divergedContent`, exactly the old model's behaviour isolated to this one language. */
  isDiverged: boolean;
  /** Populated only when `isDiverged` is true — a full fork taken at the moment of divergence. `null` for as long as the translation stays linked. */
  divergedContent: PageContent | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** The last person to change anything here, resolved to a name only for display — see PageGroupListItem. */
  updatedBy: string | null;
  /** When this language's own content last changed — not its address or its SEO, both of which are read live and need no publish. Paired with `publishedAt` to tell whether what is online is still what the editor sees. */
  contentUpdatedAt: Date;
  /** When this language was last published, or null if it never was. */
  publishedAt: Date | null;
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
 * A pure entity, taking the place of the old per-locale Page (together with
 * PageGroup). Unlike yesterday, creating a translation is cheap —
 * `fieldValues: {}`, no wholesale copy of the structure — because the
 * structure no longer belongs to it: it lives on PageGroup.
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
      formerSlugs: [],
      seoMeta: input.seoMeta,
      fieldValues: input.fieldValues ?? {},
      status: 'draft',
      publishedSnapshot: null,
      isDiverged: false,
      divergedContent: null,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
      updatedBy: input.createdBy ?? null,
      contentUpdatedAt: now,
      publishedAt: null,
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

  get formerSlugs(): readonly string[] {
    return this.props.formerSlugs;
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

  get updatedBy(): string | null {
    return this.props.updatedBy;
  }

  get contentUpdatedAt(): Date {
    return this.props.contentUpdatedAt;
  }

  get publishedAt(): Date | null {
    return this.props.publishedAt;
  }

  /** Updates slug/seoMeta — still per-locale as before, independent of the structure's draft/publish state (the same reasoning as Page.updateSeoMeta, ADR-0014). */
  updateSeoMeta(seoMeta: SeoMeta, edit: EditContext): void {
    this.props.seoMeta = seoMeta;
    this.touch(edit);
  }

  /**
   * Moves this translation to a new address, and remembers the one it
   * left.
   *
   * The memory is the whole point. A page's URL used to be decided once
   * and never again, so the only way to fix a wrong one was to delete
   * the page — and renaming without keeping the old address would trade
   * that for a quieter failure: every link anyone had saved, and the
   * page's own ranking, gone with nothing to say so. What the former
   * address buys is a 301 (`get-published-page-by-slug`), which is how a
   * move is supposed to be announced.
   *
   * Renaming back to an address this page already had drops it from the
   * history rather than leaving it in both places, so a slug is never
   * both the current answer and a redirect to itself.
   */
  updateSlug(slug: string, edit: EditContext): void {
    if (slug === this.props.slug) return;
    this.props.formerSlugs = [
      ...this.props.formerSlugs.filter((former) => former !== slug),
      this.props.slug,
    ];
    this.props.slug = slug;
    this.touch(edit);
  }

  /** Saves this language's text overlay — NOT valid on an unlinked translation (the use case must check `isDiverged` before calling; the pure entity has no access to the field descriptors and cannot tell on its own). */
  saveFieldValues(fieldValues: FieldValueOverlay, edit: EditContext): void {
    this.props.fieldValues = fieldValues;
    this.props.contentUpdatedAt = this.touch(edit);
  }

  /** Promotes the current merge (computed by the caller — mergeTranslatedContent(group.content, this.fieldValues), or `divergedContent` when unlinked) to this language's published version. */
  publish(mergedContent: PageContent, edit: EditContext): void {
    this.props.publishedSnapshot = mergedContent;
    this.props.status = 'published';
    this.props.publishedAt = this.touch(edit);
  }

  /**
   * Unlinks this translation from the shared structure — a full fork:
   * `currentMergedContent` (computed by the caller, the same merge as
   * publish()) becomes the new, independent `divergedContent`. After this
   * call, structural changes to PageGroup.content no longer reach this
   * translation — use `saveDivergedContent` for subsequent edits, no longer
   * `saveFieldValues`. Irreversible in v1 (there is no "relink" — see the
   * plan, it is ambiguous which changes would win).
   */
  diverge(currentMergedContent: PageContent, edit: EditContext): void {
    this.props.isDiverged = true;
    this.props.divergedContent = currentMergedContent;
    this.props.contentUpdatedAt = this.touch(edit);
  }

  /** Updates the independent content of an ALREADY unlinked translation — the use case must check `isDiverged` before calling, the same discipline as saveFieldValues. */
  saveDivergedContent(content: PageContent, edit: EditContext): void {
    this.props.divergedContent = content;
    this.props.contentUpdatedAt = this.touch(edit);
  }

  /** Records the author and the moment of a change, and hands back that moment for whoever also needs it. */
  private touch(edit: EditContext): Date {
    const now = edit.now ?? new Date();
    this.props.updatedAt = now;
    this.props.updatedBy = edit.by;
    return now;
  }
}
