import {
  gutenbergBlockSupport,
  qualifyGutenbergBlockName,
  type WordPressAnalysis,
  type WordPressAnalysisWarning,
} from '@brisk/shared-types';
import type {
  WordPressExportItem,
  WordPressExportReaderPort,
} from '@brisk/ports';

export interface AnalyzeWordPressExportDeps {
  exportReader: WordPressExportReaderPort;
}

export interface AnalyzeWordPressExportInput {
  filePath: string;
}

/** The post types the import brings across. Everything else is reported, not imported. */
const IMPORTED_TYPES = new Set(['page', 'post']);

/**
 * Taxonomies that are plugin bookkeeping rather than how a site files its
 * content, and would only pad the report.
 *
 * `translation_priority` is WPML's; `post_format` is WordPress's own
 * standard/aside/gallery flag; the Polylang pair is how it stores which
 * language a post is in, which the multilingual warning already says.
 */
const INTERNAL_TAXONOMIES = new Set([
  'translation_priority',
  'post_format',
  'language',
  'post_translations',
  'product_visibility',
  'product_type',
]);

/**
 * Postmeta keys that give away a page builder, and the name to report.
 *
 * Detection by key, because the layout these plugins hold is in their own
 * format inside that value — unreadable here, and worth saying out loud
 * before anybody decides to import.
 */
const PAGE_BUILDERS: { key: string; name: string }[] = [
  { key: '_elementor_data', name: 'Elementor' },
  { key: '_et_pb_use_builder', name: 'Divi' },
  { key: '_fl_builder_data', name: 'Beaver Builder' },
  { key: '_vc_post_settings', name: 'WPBakery' },
];

/** Postmeta and taxonomies that give away a multilingual plugin. */
const MULTILINGUAL_META_PREFIXES: { prefix: string; name: string }[] = [
  { prefix: '_icl_', name: 'WPML' },
  { prefix: '_wpml_', name: 'WPML' },
  { prefix: '_pll_', name: 'Polylang' },
];

/** `<!-- wp:name ... -->`, opening tags only: a self-closing block has no closing comment, and `/wp:` is the close. */
const BLOCK_OPENING = /<!--\s+wp:([a-z0-9][a-z0-9/-]*)/g;

/**
 * What a WordPress export would actually bring across, said out loud
 * before anything is imported.
 *
 * This exists because every importer on the market fails the same way:
 * quietly. Pages arrive missing their middle, a catalogue of four hundred
 * products arrives as nothing, and the person finds out weeks later. The
 * first thing this one does is count, and the counting is deliberately
 * pessimistic — a block nobody has mapped is reported as quarantine, not
 * hoped about.
 *
 * Nothing is written. The file is read once, streamed, and the numbers
 * are all that is kept: the two client sites this was built against are
 * 6.5 MB and 314 MB, and the second holds 43 597 entries.
 */
export async function analyzeWordPressExport(
  deps: AnalyzeWordPressExportDeps,
  input: AnalyzeWordPressExportInput,
): Promise<WordPressAnalysis> {
  const byType = new Map<string, number>();
  const quarantined = new Map<string, number>();
  const termsByTaxonomy = new Map<string, number>();
  const pageBuilders = new Map<string, number>();
  const multilingual = new Set<string>();

  let whole = 0;
  let partial = 0;
  let empty = 0;
  let totalBlocks = 0;
  let nativeBlocks = 0;
  let droppedBlocks = 0;
  const emptyTitles: string[] = [];

  const channel = await deps.exportReader.read(input.filePath, (item) => {
    byType.set(item.postType, (byType.get(item.postType) ?? 0) + 1);
    notePlugins(item, pageBuilders, multilingual);

    if (!IMPORTED_TYPES.has(item.postType) || isNotWorthImporting(item)) {
      return;
    }

    // Counted from the items being imported, not from the file's own list
    // of terms. One real site declares 36 taxonomies, 35 of them
    // WooCommerce product attributes with 659 terms in one of them — none
    // of which apply to a page, and all of which would bury the one
    // taxonomy that does.
    for (const term of item.terms) {
      if (INTERNAL_TAXONOMIES.has(term.taxonomy)) continue;
      termsByTaxonomy.set(
        term.taxonomy,
        (termsByTaxonomy.get(term.taxonomy) ?? 0) + 1,
      );
    }

    const counted = countBlocks(item.content);
    totalBlocks += counted.total;
    nativeBlocks += counted.native;
    droppedBlocks += counted.dropped;
    for (const [name, count] of counted.quarantined) {
      quarantined.set(name, (quarantined.get(name) ?? 0) + count);
    }

    if (item.content.trim() === '') {
      empty += 1;
      // Named, not just counted: "5 pages arrive empty" is a number,
      // "Home, Contatti… arrive empty" is something to act on.
      if (emptyTitles.length < 10) emptyTitles.push(item.title || item.slug);
    } else if (counted.quarantined.size > 0) {
      partial += 1;
    } else {
      whole += 1;
    }
  });

  const otherTypes = [...byType]
    .filter(([type]) => !KNOWN_TYPES.has(type))
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    siteTitle: channel.title,
    sourceUrl: channel.baseBlogUrl || channel.baseSiteUrl,
    found: {
      pages: byType.get('page') ?? 0,
      posts: byType.get('post') ?? 0,
      attachments: byType.get('attachment') ?? 0,
      menuItems: byType.get('nav_menu_item') ?? 0,
      otherTypes,
    },
    pages: { whole, partial, empty },
    blocks: {
      total: totalBlocks,
      native: nativeBlocks,
      dropped: droppedBlocks,
      quarantined: [...quarantined]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    },
    terms: [...termsByTaxonomy]
      .map(([taxonomy, count]) => ({ taxonomy, count }))
      .sort((a, b) => b.count - a.count),
    warnings: buildWarnings({
      pageBuilders,
      multilingual,
      emptyTitles,
      empty,
      otherTypes,
      menuItems: byType.get('nav_menu_item') ?? 0,
    }),
  };
}

/**
 * The types the analysis accounts for by name. Everything else is a custom
 * post type — which on a real site is usually most of it, and is the
 * number the person needs to see.
 */
const KNOWN_TYPES = new Set([
  'page',
  'post',
  'attachment',
  'nav_menu_item',
  'revision',
  'custom_css',
  'customize_changeset',
  'oembed_cache',
  'user_request',
  'wp_global_styles',
  'acf-field',
  'acf-field-group',
]);

/** WordPress keeps drafts of drafts; only what somebody would recognise as their page counts. */
function isNotWorthImporting(item: WordPressExportItem): boolean {
  return item.status === 'auto-draft' || item.status === 'trash';
}

function countBlocks(content: string): {
  total: number;
  native: number;
  dropped: number;
  quarantined: Map<string, number>;
} {
  const quarantined = new Map<string, number>();
  let total = 0;
  let native = 0;
  let dropped = 0;

  for (const match of content.matchAll(BLOCK_OPENING)) {
    const name = qualifyGutenbergBlockName(match[1]);
    total += 1;
    const support = gutenbergBlockSupport(name);
    if (support === 'native') native += 1;
    else if (support === 'dropped') dropped += 1;
    else quarantined.set(name, (quarantined.get(name) ?? 0) + 1);
  }

  // No block delimiters at all and a body that is not empty: a classic
  // WordPress page, from before Gutenberg or written by a theme. It is
  // HTML, which converts — so it counts as one native block rather than
  // as nothing, which would have read as "this page is empty".
  if (total === 0 && content.trim() !== '') {
    return { total: 1, native: 1, dropped: 0, quarantined };
  }
  return { total, native, dropped, quarantined };
}

function notePlugins(
  item: WordPressExportItem,
  pageBuilders: Map<string, number>,
  multilingual: Set<string>,
): void {
  for (const key of item.metaKeys) {
    for (const builder of PAGE_BUILDERS) {
      if (key === builder.key) {
        pageBuilders.set(
          builder.name,
          (pageBuilders.get(builder.name) ?? 0) + 1,
        );
      }
    }
    for (const plugin of MULTILINGUAL_META_PREFIXES) {
      if (key.startsWith(plugin.prefix)) multilingual.add(plugin.name);
    }
  }
  for (const term of item.terms) {
    if (term.taxonomy === 'language' || term.taxonomy === 'post_translations') {
      multilingual.add('Polylang');
    }
  }
}

function buildWarnings(context: {
  pageBuilders: Map<string, number>;
  multilingual: Set<string>;
  emptyTitles: string[];
  empty: number;
  otherTypes: { type: string; count: number }[];
  menuItems: number;
}): WordPressAnalysisWarning[] {
  const warnings: WordPressAnalysisWarning[] = [];

  for (const [name, count] of context.pageBuilders) {
    warnings.push({ kind: 'page-builder', count, detail: [name] });
  }
  if (context.multilingual.size > 0) {
    warnings.push({
      kind: 'multilingual',
      count: context.multilingual.size,
      detail: [...context.multilingual],
    });
  }
  if (context.empty > 0) {
    warnings.push({
      kind: 'content-outside-the-post',
      count: context.empty,
      detail: context.emptyTitles,
    });
  }
  const otherTotal = context.otherTypes.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );
  if (otherTotal > 0) {
    warnings.push({
      kind: 'unsupported-post-types',
      count: otherTotal,
      detail: context.otherTypes
        .slice(0, 6)
        .map((entry) => `${entry.type} (${entry.count})`),
    });
  }
  if (context.menuItems > 0) {
    warnings.push({ kind: 'menus', count: context.menuItems, detail: [] });
  }
  return warnings;
}
