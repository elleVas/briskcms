import { describe, expect, it } from 'vitest';
import { pageBlockCategories, pageBlocks } from './config.js';

describe('pageBlocks', () => {
  it('registers all 39 page blocks, each with a unique type', () => {
    expect(pageBlocks).toHaveLength(39);
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
