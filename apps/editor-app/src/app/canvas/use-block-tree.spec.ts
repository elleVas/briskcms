import { describe, expect, it } from 'vitest';
import type { Block } from '@brisk/shared-types';
import {
  findBlockInTree,
  insertBlock,
  moveBlock,
  removeBlock,
  updateBlockProps,
} from './use-block-tree.js';

function tree(): Block[] {
  return [
    { id: 'hero-1', type: 'Hero', props: { title: 'Old' } },
    {
      id: 'container-1',
      type: 'Container',
      props: {},
      children: [{ id: 'text-1', type: 'Text', props: { body: 'nested' } }],
    },
  ];
}

describe('findBlockInTree', () => {
  it('finds a top-level block', () => {
    expect(findBlockInTree(tree(), 'hero-1')?.type).toBe('Hero');
  });

  it('finds a nested block', () => {
    expect(findBlockInTree(tree(), 'text-1')?.type).toBe('Text');
  });

  it('returns null for an unknown id', () => {
    expect(findBlockInTree(tree(), 'ghost')).toBeNull();
  });
});

describe('updateBlockProps', () => {
  it('merges new props onto the existing ones, at the top level', () => {
    const result = updateBlockProps(tree(), 'hero-1', { title: 'New' });
    expect(result[0].props).toEqual({ title: 'New' });
  });

  it('merges new props without dropping untouched fields', () => {
    const blocks: Block[] = [
      { id: 'hero-1', type: 'Hero', props: { title: 'T', subtitle: 'S' } },
    ];
    const result = updateBlockProps(blocks, 'hero-1', { title: 'New' });
    expect(result[0].props).toEqual({ title: 'New', subtitle: 'S' });
  });

  it('updates a block nested inside children', () => {
    const result = updateBlockProps(tree(), 'text-1', { body: 'changed' });
    expect(result[1].children?.[0].props).toEqual({ body: 'changed' });
  });

  it('never mutates the input tree', () => {
    const original = tree();
    const snapshot = JSON.parse(JSON.stringify(original));
    updateBlockProps(original, 'hero-1', { title: 'New' });
    expect(original).toEqual(snapshot);
  });

  it('leaves the tree unchanged for an unknown id', () => {
    const original = tree();
    const result = updateBlockProps(original, 'ghost', { x: 1 });
    expect(result).toEqual(original);
  });
});

describe('removeBlock', () => {
  it('removes a top-level block', () => {
    const result = removeBlock(tree(), 'hero-1');
    expect(result.map((b) => b.id)).toEqual(['container-1']);
  });

  it('removes a block nested inside children', () => {
    const result = removeBlock(tree(), 'text-1');
    expect(result[1].children).toEqual([]);
  });
});

describe('insertBlock', () => {
  it('inserts at the root at the given index', () => {
    const newBlock: Block = { id: 'new-1', type: 'Text', props: {} };
    const result = insertBlock(tree(), newBlock, { parentId: null, index: 1 });
    expect(result.map((b) => b.id)).toEqual(['hero-1', 'new-1', 'container-1']);
  });

  it('inserts inside a specific parent, at the given index', () => {
    const newBlock: Block = { id: 'new-1', type: 'Text', props: {} };
    const result = insertBlock(tree(), newBlock, {
      parentId: 'container-1',
      index: 0,
    });
    const container = result.find((b) => b.id === 'container-1');
    expect(container?.children?.map((c) => c.id)).toEqual(['new-1', 'text-1']);
  });

  it('leaves the tree unchanged for an unknown parentId', () => {
    const original = tree();
    const newBlock: Block = { id: 'new-1', type: 'Text', props: {} };
    const result = insertBlock(original, newBlock, {
      parentId: 'ghost',
      index: 0,
    });
    expect(result).toEqual(original);
  });
});

describe('moveBlock', () => {
  it('moves a top-level block to a new parent, preserving its own children', () => {
    const result = moveBlock(tree(), 'hero-1', {
      parentId: 'container-1',
      index: 0,
    });
    expect(result.map((b) => b.id)).toEqual(['container-1']);
    const container = result[0];
    expect(container.children?.map((c) => c.id)).toEqual(['hero-1', 'text-1']);
  });

  it('moves a nested block back to the root', () => {
    const result = moveBlock(tree(), 'text-1', { parentId: null, index: 0 });
    expect(result.map((b) => b.id)).toEqual([
      'text-1',
      'hero-1',
      'container-1',
    ]);
    expect(result[2].children).toEqual([]);
  });

  it('leaves the tree unchanged for an unknown blockId', () => {
    const original = tree();
    const result = moveBlock(original, 'ghost', { parentId: null, index: 0 });
    expect(result).toEqual(original);
  });
});
