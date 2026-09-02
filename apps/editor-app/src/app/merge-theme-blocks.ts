import type { BlockDescriptor } from '@brisk/block-registry';
import type { ThemeBlockEntry } from '@brisk/shared-types';
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
): PageBlockRegistry {
  const categories = coreCategories.map((category) => ({
    ...category,
    types: [...category.types],
  }));
  const registry = [...coreBlocks];

  for (const entry of themeEntries) {
    registry.push(entry.descriptor);
    const category = categories.find(
      (c) => c.title === `blocks.categories.${entry.descriptor.category}`,
    );
    category?.types.push(entry.descriptor.type);
  }

  return { registry, categories };
}
