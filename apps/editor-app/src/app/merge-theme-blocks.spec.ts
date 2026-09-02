import { describe, expect, it } from 'vitest';
import type { BlockDescriptor } from '@brisk/block-registry';
import type { ThemeBlockEntry } from '@brisk/shared-types';
import type { BlockPickerCategory } from './canvas/block-picker';
import { mergeThemeBlocks } from './merge-theme-blocks';

const coreBlocks: BlockDescriptor[] = [
  {
    type: 'Heading',
    label: 'blocks.heading.label',
    category: 'content',
    defaultProps: {},
    fields: [],
  },
];

const coreCategories: BlockPickerCategory[] = [
  { title: 'blocks.categories.layout', types: ['Columns'] },
  { title: 'blocks.categories.content', types: ['Heading'] },
];

function themeEntry(
  overrides: Partial<ThemeBlockEntry['descriptor']> = {},
): ThemeBlockEntry {
  return {
    descriptor: {
      type: 'StatusBadge',
      label: 'blocks.statusBadge.label',
      category: 'content',
      defaultProps: { label: 'Beta', tone: 'info' },
      fields: [],
      ...overrides,
    },
    locales: {
      en: { label: 'Status Badge' },
      it: { label: 'Badge di stato' },
    },
  };
}

describe('mergeThemeBlocks', () => {
  it('appends the theme block to the registry', () => {
    const { registry } = mergeThemeBlocks(coreBlocks, coreCategories, [
      themeEntry(),
    ]);
    expect(registry.map((b) => b.type)).toEqual(['Heading', 'StatusBadge']);
  });

  it('appends the theme block type to the matching category, alongside the core block already there', () => {
    const { categories } = mergeThemeBlocks(coreBlocks, coreCategories, [
      themeEntry(),
    ]);
    const content = categories.find(
      (c) => c.title === 'blocks.categories.content',
    );
    expect(content?.types).toEqual(['Heading', 'StatusBadge']);
  });

  it('leaves other categories untouched', () => {
    const { categories } = mergeThemeBlocks(coreBlocks, coreCategories, [
      themeEntry(),
    ]);
    const layout = categories.find(
      (c) => c.title === 'blocks.categories.layout',
    );
    expect(layout?.types).toEqual(['Columns']);
  });

  it('does not mutate the input arrays', () => {
    const originalCoreBlocksLength = coreBlocks.length;
    const originalContentTypes = [...coreCategories[1].types];
    mergeThemeBlocks(coreBlocks, coreCategories, [themeEntry()]);
    expect(coreBlocks).toHaveLength(originalCoreBlocksLength);
    expect(coreCategories[1].types).toEqual(originalContentTypes);
  });

  it('returns the core registry and categories unchanged when there are no theme entries', () => {
    const { registry, categories } = mergeThemeBlocks(
      coreBlocks,
      coreCategories,
      [],
    );
    expect(registry).toEqual(coreBlocks);
    expect(categories).toEqual(coreCategories);
  });

  it('merges multiple theme blocks into their own respective categories', () => {
    const layoutEntry = themeEntry({
      type: 'Spacer',
      label: 'blocks.spacer.label',
      category: 'layout',
    });
    const { categories } = mergeThemeBlocks(coreBlocks, coreCategories, [
      themeEntry(),
      layoutEntry,
    ]);
    expect(
      categories.find((c) => c.title === 'blocks.categories.content')?.types,
    ).toEqual(['Heading', 'StatusBadge']);
    expect(
      categories.find((c) => c.title === 'blocks.categories.layout')?.types,
    ).toEqual(['Columns', 'Spacer']);
  });
});
