import type { PageContent } from '@brisk/shared-types';

export interface PageGroupProps {
  id: string;
  tenantId: string;
  siteId: string;
  /** A hierarchy SHARED across every language of this group — unlike the old `Page.parentId` (which was per-locale), it makes no sense for two languages of the same page to live at different points in the site's tree. */
  parentId: string | null;
  /** The position among siblings, shared for the same reason as `parentId` — see setPageOrder's own comment about the old model. */
  order: number;
  /** The canonical block tree. For a field marked `translatable` (see FieldDescriptor in @brisk/block-registry), the value here is the site's default language's — the fallback used until a PageTranslation has an override of its own (see mergeTranslatedContent). */
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
 * A pure entity, in the same style as Page (which this and PageTranslation
 * take the place of — see ADR-0017's supersession). It owns the structure
 * SHARED across every language: adding, removing or reordering a block here
 * applies to every linked PageTranslation (not an "unlinked" one, see
 * PageTranslation.isDiverged) in one go — which is the whole point of the
 * field-level i18n redesign, eliminating the structural drift the old model
 * could only report and never prevent.
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

  /** Reassigns the parent in the hierarchy — the same discipline as Page.setParent: cycle and same-site validation belong to the use case (which has repository access), since the pure entity cannot walk the chain itself. */
  setParent(parentId: string | null, now: Date = new Date()): void {
    this.props.parentId = parentId;
    this.props.updatedAt = now;
  }

  /** Reassigns the position among siblings — the same discipline as Page.reorder: the permutation's validity is the use case's business, not the entity's. */
  reorder(order: number, now: Date = new Date()): void {
    this.props.order = order;
    this.props.updatedAt = now;
  }

  /** Updates the shared structure (the draft) — it propagates to every linked PageTranslation, never to unlinked ones (see PageTranslation.isDiverged). */
  saveContent(content: PageContent, now: Date = new Date()): void {
    this.props.content = content;
    this.props.updatedAt = now;
  }
}
