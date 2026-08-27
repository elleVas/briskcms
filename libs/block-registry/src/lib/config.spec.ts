import { describe, expect, it } from 'vitest';
import { BLOCK_STYLE_DEFAULTS } from '@brisk/shared-types';
import { pageBlockCategories, pageBlocks } from './config.js';
import { headerFooterBlocks } from './layout-config.js';

describe('pageBlocks', () => {
  // Security review 2026-08-24: not a literal count — that broke for the
  // wrong reason (a legitimate new block) every time one was added/removed.
  // What actually matters is that every registered type is unique.
  it('registers page blocks, each with a unique type', () => {
    expect(pageBlocks.length).toBeGreaterThan(0);
    const types = pageBlocks.map((block) => block.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('gives every block a label, category, defaultProps and fields array', () => {
    for (const block of pageBlocks) {
      expect(block.label.length).toBeGreaterThan(0);
      expect(block.category.length).toBeGreaterThan(0);
      expect(block.defaultProps).toBeTypeOf('object');
      expect(Array.isArray(block.fields)).toBe(true);
    }
  });

  it('never lets a `render` function slip back in (data only, per the plan)', () => {
    for (const block of pageBlocks) {
      expect('render' in block).toBe(false);
    }
  });
});

describe('pageBlockCategories', () => {
  it('places every registered block type in exactly one category, with no leftovers', () => {
    const registeredTypes = pageBlocks.map((block) => block.type).sort();
    const categorizedTypes = pageBlockCategories
      .flatMap((category) => category.types)
      .sort();

    expect(categorizedTypes).toEqual(registeredTypes);
  });

  it('never lists the same type in two categories', () => {
    const allTypes = pageBlockCategories.flatMap((category) => category.types);
    expect(new Set(allTypes).size).toBe(allTypes.length);
  });
});

// Security review 2026-08-24, point 16: nulla verificava che
// `stylableProperties` di un blocco corrispondesse alle chiavi presenti in
// `BLOCK_STYLE_DEFAULTS` — un disallineamento (es. un blocco dichiara
// `backgroundColor` ma il suo `BLOCK_STYLE_DEFAULTS` non la definisce)
// passava inosservato. header/footer + page blocks insieme (Text/Image/
// SearchBox condivisi tra i due, deduplicati per tipo).
describe('stylableProperties / BLOCK_STYLE_DEFAULTS alignment', () => {
  const allBlocksByType = new Map(
    [...pageBlocks, ...headerFooterBlocks].map((block) => [block.type, block]),
  );

  it('gives every block with stylableProperties a BLOCK_STYLE_DEFAULTS entry with exactly those keys', () => {
    for (const block of allBlocksByType.values()) {
      if (!block.stylableProperties || block.stylableProperties.length === 0) {
        continue;
      }
      const defaults = BLOCK_STYLE_DEFAULTS[block.type];
      expect(
        defaults,
        `${block.type} declares stylableProperties but has no BLOCK_STYLE_DEFAULTS entry`,
      ).toBeDefined();
      expect(Object.keys(defaults ?? {}).sort()).toEqual(
        [...block.stylableProperties].sort(),
      );
    }
  });
});
