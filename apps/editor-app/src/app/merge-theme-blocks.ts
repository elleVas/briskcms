import type { BlockDescriptor } from '@brisk/block-registry';
import type {
  ThemeBlockEntry,
  ThemeBlockVariantsResponse,
} from '@brisk/shared-types';
import type { BlockPickerCategory } from './canvas/block-picker';

export interface PageBlockRegistry {
  registry: BlockDescriptor[];
  categories: BlockPickerCategory[];
}

/**
 * Docs/adr/0041 — folds a theme's own extra block types into the core
 * `pageBlocks`/`pageBlockCategories` pair, the same shape
 * `page-group-editor-view.tsx` already passes straight through to
 * `CanvasEditorShell`. `ThemeBlockEntry['descriptor']` (the hand-written
 * wire schema in `@brisk/shared-types`) is structurally assignable to
 * `BlockDescriptor` without a cast — every field lines up exactly,
 * `theme-blocks.ts`'s own comment explains why it's a separate type
 * rather than derived from `BlockDescriptor` directly.
 *
 * A theme block joins the SAME accordion category a core block of that
 * `category` already renders under (no separate "theme blocks" bucket) —
 * reuses `BlockDescriptor.category`, previously vestigial for core
 * blocks. `themeBlockCategorySchema` only allows the 6 slugs
 * `pageBlockCategories` already has a bucket for, so the `find()` below
 * can't actually miss in practice — kept as a graceful skip (not a
 * throw) anyway: this runs in the browser against a same-session HTTP
 * response, and a skipped block degrading out of the picker is a far
 * better failure mode here than crashing the whole editor over one bad
 * entry (the throw-loud posture belongs at the server/build boundary,
 * see resolve-theme-page-blocks.ts's own comment on that split).
 */
export function mergeThemeBlocks(
  coreBlocks: BlockDescriptor[],
  coreCategories: BlockPickerCategory[],
  themeEntries: ThemeBlockEntry[],
  themeVariants: ThemeBlockVariantsResponse = {},
): PageBlockRegistry {
  const categories = coreCategories.map((category) => ({
    ...category,
    types: [...category.types],
  }));
  const registry = coreBlocks.map((descriptor) =>
    withThemeVariants(descriptor, themeVariants[descriptor.type]),
  );

  for (const entry of themeEntries) {
    registry.push(entry.descriptor);
    const category = categories.find(
      (c) => c.title === `blocks.categories.${entry.descriptor.category}`,
    );
    category?.types.push(entry.descriptor.type);
  }

  return { registry, categories };
}

/**
 * A core block plus the looks this theme adds to it (ADR-0047, under
 * ADR-0048's additive rule) — appended, never replacing: the block keeps
 * every variant it declares itself, and gains the theme's.
 *
 * The label a theme sends is a string per locale, registered into
 * i18next under `blocks.<type>.variants.<value>` by
 * `themeBlockVariantsQueryOptions`. What the descriptor carries is that
 * key, exactly as a core variant does — so nothing downstream has to
 * know, or ask, where a given look came from.
 *
 * A theme redeclaring a value the block already has is refused at the
 * source (each theme's `blocks.spec.ts`, which can see the core
 * registry). Skipped here as well rather than trusted, because this runs
 * in a browser against an HTTP response: a duplicate would put the same
 * entry in the picker twice, one of them unreachable.
 */
function withThemeVariants(
  descriptor: BlockDescriptor,
  added: ThemeBlockVariantsResponse[string] | undefined,
): BlockDescriptor {
  if (!added?.length) {
    return descriptor;
  }
  const own = new Set((descriptor.variants ?? []).map((v) => v.value));
  const key = `${descriptor.type.charAt(0).toLowerCase()}${descriptor.type.slice(1)}`;
  const extra = added
    .filter((variant) => !own.has(variant.value))
    .map((variant) => ({
      value: variant.value,
      label: `blocks.${key}.variants.${variant.value}`,
    }));
  return extra.length > 0
    ? { ...descriptor, variants: [...(descriptor.variants ?? []), ...extra] }
    : descriptor;
}
