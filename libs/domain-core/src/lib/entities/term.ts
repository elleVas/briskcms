import type { LocalizedSeoMeta, LocalizedText } from '@brisk/shared-types';

export interface TermProps {
  id: string;
  tenantId: string;
  siteId: string;
  taxonomyId: string;
  parentId: string | null;
  name: LocalizedText;
  description: LocalizedText;
  seoMeta: LocalizedSeoMeta;
  landingPageGroupId: string | null;
  order: number;
  /** locale -> the slug this term answers to in that language. */
  slugs: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTermProps {
  id: string;
  tenantId: string;
  siteId: string;
  taxonomyId: string;
  parentId?: string | null;
  name: LocalizedText;
  slugs: Record<string, string>;
  order?: number;
  now?: Date;
}

/**
 * One value inside a dimension — "Espresso machines" inside "Category"
 * (docs/adr/0064).
 *
 * `slugs` is a map here and a table in the database, and both are right:
 * the entity is the whole term, while Postgres needs one row per language
 * to be able to refuse two terms answering at one address.
 */
export class Term {
  private constructor(private props: TermProps) {}

  static create(input: CreateTermProps): Term {
    const now = input.now ?? new Date();
    return new Term({
      id: input.id,
      tenantId: input.tenantId,
      siteId: input.siteId,
      taxonomyId: input.taxonomyId,
      parentId: input.parentId ?? null,
      name: input.name,
      description: {},
      seoMeta: {},
      landingPageGroupId: null,
      order: input.order ?? 0,
      slugs: { ...input.slugs },
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: TermProps): Term {
    return new Term({ ...props, slugs: { ...props.slugs } });
  }

  toProps(): TermProps {
    return { ...this.props, slugs: { ...this.props.slugs } };
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

  get taxonomyId(): string {
    return this.props.taxonomyId;
  }

  get parentId(): string | null {
    return this.props.parentId;
  }

  get name(): LocalizedText {
    return this.props.name;
  }

  get description(): LocalizedText {
    return this.props.description;
  }

  get seoMeta(): LocalizedSeoMeta {
    return this.props.seoMeta;
  }

  get landingPageGroupId(): string | null {
    return this.props.landingPageGroupId;
  }

  get order(): number {
    return this.props.order;
  }

  get slugs(): Record<string, string> {
    return { ...this.props.slugs };
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** The slug this term answers to in one language, or `null` where it has none — a term exists before it has been named everywhere. */
  slugFor(locale: string): string | null {
    return this.props.slugs[locale] ?? null;
  }

  rename(name: LocalizedText, now: Date = new Date()): void {
    this.props.name = name;
    this.props.updatedAt = now;
  }

  setDescription(description: LocalizedText, now: Date = new Date()): void {
    this.props.description = description;
    this.props.updatedAt = now;
  }

  setSeoMeta(seoMeta: LocalizedSeoMeta, now: Date = new Date()): void {
    this.props.seoMeta = seoMeta;
    this.props.updatedAt = now;
  }

  /**
   * Sets — or, with `null`, removes — this term's address in one
   * language. Removing it does not delete the term: the term simply has
   * no page in that language, the same state it was in before anyone
   * wrote a slug for it.
   */
  setSlug(locale: string, slug: string | null, now: Date = new Date()): void {
    if (slug === null) {
      delete this.props.slugs[locale];
    } else {
      this.props.slugs[locale] = slug;
    }
    this.props.updatedAt = now;
  }

  /**
   * The page rendered ON this term's URL instead of the default layout —
   * `null` gives the default layout back. Never a redirect, which is what
   * lets that page be unlinked or deleted without breaking the address
   * (docs/adr/0064).
   */
  setLandingPage(pageGroupId: string | null, now: Date = new Date()): void {
    this.props.landingPageGroupId = pageGroupId;
    this.props.updatedAt = now;
  }

  moveTo(parentId: string | null, now: Date = new Date()): void {
    this.props.parentId = parentId;
    this.props.updatedAt = now;
  }

  setOrder(order: number, now: Date = new Date()): void {
    this.props.order = order;
    this.props.updatedAt = now;
  }
}
