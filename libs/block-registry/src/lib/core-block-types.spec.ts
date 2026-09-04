import { describe, expect, it } from 'vitest';
import { CORE_BLOCK_TYPES } from '@brisk/block-sdk';
import { pageBlocks } from './config';
import { headerFooterBlocks } from './layout-config';

/**
 * The anti-drift guard for `@brisk/block-sdk`'s `CORE_BLOCK_TYPES`.
 *
 * That constant has to be a literal list: block-sdk is what a theme built
 * outside this monorepo depends on, and this package is React plus editor
 * UI (ADR-0037 fixed that dependency direction deliberately). So the list
 * cannot be derived — but it must not silently rot either, and adding a
 * core block type is exactly the moment someone would forget.
 *
 * This file is the one place in the workspace allowed to know both, and
 * it fails naming precisely what to add or remove.
 */
describe('CORE_BLOCK_TYPES', () => {
  it('matches the registry exactly', () => {
    const actual = [
      ...new Set([...pageBlocks, ...headerFooterBlocks].map((b) => b.type)),
    ].sort();

    expect(
      [...CORE_BLOCK_TYPES].sort(),
      'block-sdk/src/lib/core-block-types.ts is out of date with this registry — add or remove the types the diff shows',
    ).toEqual(actual);
  });
});
