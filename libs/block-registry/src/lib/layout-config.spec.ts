import { describe, expect, it } from 'vitest';
import { pageBlocks } from './config.js';
import { headerFooterBlocks } from './layout-config.js';

describe('headerFooterBlocks', () => {
  it('registers all 11 header/footer blocks, each with a unique type', () => {
    expect(headerFooterBlocks).toHaveLength(11);
    const types = headerFooterBlocks.map((block) => block.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('reuses the exact same Text/Image/SearchBox descriptors as the page palette — no duplication', () => {
    const shared = ['Text', 'Image', 'SearchBox'];
    for (const type of shared) {
      const pageVersion = pageBlocks.find((block) => block.type === type);
      const layoutVersion = headerFooterBlocks.find(
        (block) => block.type === type,
      );
      expect(layoutVersion).toBe(pageVersion);
    }
  });

  it('has 8 blocks exclusive to header/footer, absent from the page palette', () => {
    const pageTypes = new Set(pageBlocks.map((block) => block.type));
    const exclusive = headerFooterBlocks.filter(
      (block) => !pageTypes.has(block.type),
    );
    expect(exclusive).toHaveLength(8);
  });
});
