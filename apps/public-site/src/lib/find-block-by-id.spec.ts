import { describe, expect, it } from 'vitest';
import type { Block } from '@brisk/shared-types';
import { findBlockById } from './find-block-by-id';

describe('findBlockById', () => {
  it('finds a top-level block by id', () => {
    const blocks: Block[] = [
      { id: 'a', type: 'Hero', props: {} },
      { id: 'b', type: 'Text', props: {} },
    ];
    expect(findBlockById(blocks, 'b')).toEqual(blocks[1]);
  });

  it('finds a block nested inside children, at any depth', () => {
    const blocks: Block[] = [
      {
        id: 'container',
        type: 'Container',
        props: {},
        children: [
          {
            id: 'columns',
            type: 'Columns',
            props: { layout: 'two-equal' },
            children: [{ id: 'target', type: 'Text', props: {} }],
          },
        ],
      },
    ];
    expect(findBlockById(blocks, 'target')).toEqual({
      id: 'target',
      type: 'Text',
      props: {},
    });
  });

  it('returns null when no block matches', () => {
    const blocks: Block[] = [{ id: 'a', type: 'Hero', props: {} }];
    expect(findBlockById(blocks, 'missing')).toBeNull();
  });

  it('returns null for an empty tree', () => {
    expect(findBlockById([], 'anything')).toBeNull();
  });
});
