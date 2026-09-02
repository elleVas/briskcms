import type { Block, PageContent, SeoMeta } from './content-model';

/**
 * Builds the plain-text blob a SearchPort adapter indexes for a page —
 * kept here (not in the adapter) because only this package already knows
 * every block type's shape (content-model.ts), and extraction has nothing
 * Postgres-specific about it: a future non-Postgres SearchPort adapter
 * reuses this exact function, only the storage/query side differs.
 *
 * Explicit per-block-type allowlist of "prose" fields, not "grab every
 * string prop generically": most blocks also carry non-prose string props
 * (urls, hex colors, enum values like linkType/variant/layout) that would
 * otherwise pollute the index and produce false-positive matches (e.g.
 * searching "primary" matching every Button block).
 *
 * `PROSE_FIELD_EXTRACTORS`' own keys are the authoritative "which types
 * are covered" list — `BLOCKS_WITHOUT_SEARCHABLE_TEXT` below must account
 * for every OTHER real block type, checked by
 * `config.spec.ts`'s "search-text.ts prose-field coverage" test. This is
 * what makes forgetting a new block here a build-time failure instead of
 * the silent gap Heading shipped with (2026-09-01) — this file used to be
 * a plain `switch` with a `default: return []`, which is exactly what let
 * that happen unnoticed.
 */
export function extractSearchableText(
  seoMeta: SeoMeta,
  blocks: PageContent,
): string {
  const parts = [seoMeta.title, seoMeta.description];
  collectBlockText(blocks, parts);
  return parts.filter((part) => part.trim().length > 0).join(' ');
}

function collectBlockText(blocks: PageContent, parts: string[]): void {
  for (const block of blocks) {
    parts.push(...proseFieldsFor(block));
    if (block.children) {
      collectBlockText(block.children, parts);
    }
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

type ProseFieldExtractor = (props: Record<string, unknown>) => string[];

const PROSE_FIELD_EXTRACTORS: Partial<Record<string, ProseFieldExtractor>> = {
  Hero: (props) => [asString(props['title']), asString(props['subtitle'])],
  Text: (props) => [asString(props['body'])],
  Heading: (props) => [asString(props['text'])],
  Image: (props) => [asString(props['alt']), asString(props['caption'])],
  Gallery: (props) => {
    const images = Array.isArray(props['images']) ? props['images'] : [];
    return images.map((image) =>
      asString((image as Record<string, unknown>)?.['alt']),
    );
  },
  Quote: (props) => [
    asString(props['quote']),
    asString(props['author']),
    asString(props['role']),
  ],
  Rating: (props) => [asString(props['label'])],
  Countdown: (props) => [asString(props['label'])],
  Tab: (props) => [asString(props['label'])],
  Button: (props) => [asString(props['label'])],
  Table: (props) => {
    const rows = Array.isArray(props['rows']) ? props['rows'] : [];
    return rows.flat().map((cell) => asString(cell));
  },
  AccordionItem: (props) => [
    asString(props['question']),
    asString(props['answer']),
  ],
  Banner: (props) => [
    asString(props['title']),
    asString(props['text']),
    asString(props['buttonLabel']),
  ],
  Feature: (props) => [asString(props['title']), asString(props['text'])],
  PromoBar: (props) => [asString(props['message'])],
  WhatsAppButton: (props) => [asString(props['message'])],
  Callout: (props) => [asString(props['message'])],
  NavLink: (props) => [asString(props['label'])],
  NavDropdown: (props) => [asString(props['label'])],
};

function proseFieldsFor(block: Block): string[] {
  return PROSE_FIELD_EXTRACTORS[block.type]?.(block.props) ?? [];
}

/** The authoritative "which types does search actually index" list — see `config.spec.ts`'s coverage check. */
export const SEARCHABLE_BLOCK_TYPES = Object.keys(PROSE_FIELD_EXTRACTORS);

/**
 * Every block type NOT in `PROSE_FIELD_EXTRACTORS` above, split by why.
 * `config.spec.ts` checks this list plus `PROSE_FIELD_EXTRACTORS`' keys
 * together account for every real block type with no leftovers — so
 * adding a block and forgetting both fails a real test, not a silent gap.
 */
export const BLOCKS_WITHOUT_SEARCHABLE_TEXT = [
  // Genuinely no prose of their own — pure layout/container/config blocks,
  // or (EmbedHtml) raw markup that would pollute the index rather than
  // read as prose.
  'Accordion',
  'Column',
  'Columns',
  'Container',
  'EmbedHtml',
  'Form',
  'HamburgerMenu',
  'LanguageSwitcher',
  'Nav',
  'BackToTop',
  'Tabs',

  // Real prose, not wired up yet — a genuine backlog item (found during
  // the 2026-09-02 Extension Manifest planning session, deliberately left
  // out of that plan's scope: each needs its own per-field design
  // decision, not a rushed batch). Search simply doesn't find these
  // blocks' text yet.
  'BeforeAfter',
  'Breadcrumb',
  'Code',
  'FeatureGrid',
  'ImageSlider',
  'Link',
  'LogoStrip',
  'MapEmbed',
  'NewsletterSignup',
  'PricingPlan',
  'PricingTable',
  'SearchBox',
  'Stat',
  'StatsCounter',
  'Team',
  'TeamMember',
  'Testimonial',
  'Testimonials',
  'Timeline',
  'TimelineStep',
  'VideoEmbed',
] as const;
