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
 * searching "primary" matching every Button block). Deliberately excludes
 * EmbedHtml (raw HTML/JS embed — including it verbatim would index markup
 * noise, not prose) and pure layout/config blocks with no text of their
 * own (Columns, Accordion, Tabs, Form, LanguageSwitcher, BackToTop, ...).
 * A block type not listed here simply contributes nothing — safe by
 * default, not a bug to fix urgently when a new block type is added.
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

function proseFieldsFor(block: Block): string[] {
  const props = block.props;
  switch (block.type) {
    case 'Hero':
      return [asString(props['title']), asString(props['subtitle'])];
    case 'Text':
      return [asString(props['body'])];
    case 'Image':
      return [asString(props['alt']), asString(props['caption'])];
    case 'Gallery': {
      const images = Array.isArray(props['images']) ? props['images'] : [];
      return images.map((image) =>
        asString((image as Record<string, unknown>)?.['alt']),
      );
    }
    case 'Quote':
      return [
        asString(props['quote']),
        asString(props['author']),
        asString(props['role']),
      ];
    case 'Rating':
    case 'Countdown':
    case 'Tab':
    case 'Button':
      return [asString(props['label'])];
    case 'Table': {
      const rows = Array.isArray(props['rows']) ? props['rows'] : [];
      return rows.flat().map((cell) => asString(cell));
    }
    case 'AccordionItem':
      return [asString(props['question']), asString(props['answer'])];
    case 'Banner':
      return [
        asString(props['title']),
        asString(props['text']),
        asString(props['buttonLabel']),
      ];
    case 'Feature':
      return [asString(props['title']), asString(props['text'])];
    case 'PromoBar':
    case 'WhatsAppButton':
    case 'Callout':
      return [asString(props['message'])];
    case 'NavLink':
    case 'NavDropdown':
      return [asString(props['label'])];
    default:
      return [];
  }
}
