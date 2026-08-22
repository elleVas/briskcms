import { describe, expect, it } from 'vitest';
import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import {
  cloneBlockWithNewIds,
  createBlockFromDescriptor,
  findBlockInTree,
  insertBlock,
  locateBlock,
  moveBlock,
  removeBlock,
  siblingsAt,
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

describe('locateBlock', () => {
  it('returns parentId: null and its index for a root-level block', () => {
    expect(locateBlock(tree(), 'container-1')).toEqual({
      parentId: null,
      index: 1,
    });
  });

  it("returns the real parent's id and index for a nested block", () => {
    expect(locateBlock(tree(), 'text-1')).toEqual({
      parentId: 'container-1',
      index: 0,
    });
  });

  it('returns null for an unknown id', () => {
    expect(locateBlock(tree(), 'ghost')).toBeNull();
  });
});

describe('siblingsAt', () => {
  it('returns the root blocks when parentId is null', () => {
    expect(siblingsAt(tree(), null).map((b) => b.id)).toEqual([
      'hero-1',
      'container-1',
    ]);
  });

  it("returns a container's children", () => {
    expect(siblingsAt(tree(), 'container-1').map((b) => b.id)).toEqual([
      'text-1',
    ]);
  });

  it('returns an empty array for a block with no children yet', () => {
    expect(siblingsAt(tree(), 'hero-1')).toEqual([]);
  });

  it('returns an empty array for an unknown parentId', () => {
    expect(siblingsAt(tree(), 'ghost')).toEqual([]);
  });
});

describe('cloneBlockWithNewIds', () => {
  it('copies type and props, but assigns a new id', () => {
    const [hero] = tree();
    const clone = cloneBlockWithNewIds(hero);

    expect(clone.id).not.toBe(hero.id);
    expect(clone.type).toBe('Hero');
    expect(clone.props).toEqual(hero.props);
  });

  it('does not share the props object with the original (a later edit to one leaves the other untouched)', () => {
    const [hero] = tree();
    const clone = cloneBlockWithNewIds(hero);

    clone.props['title'] = 'Changed on the clone';

    expect(hero.props['title']).toBe('Old');
  });

  it('recursively assigns new ids to every nested child, never reusing the original ids', () => {
    const [, container] = tree();
    const clone = cloneBlockWithNewIds(container);

    expect(clone.id).not.toBe(container.id);
    expect(clone.children).toHaveLength(1);
    expect(clone.children?.[0].id).not.toBe(container.children?.[0].id);
    expect(clone.children?.[0].type).toBe('Text');
    expect(clone.children?.[0].props).toEqual(container.children?.[0].props);
  });

  it('gives every clone a distinct id, even across repeated calls', () => {
    const [hero] = tree();
    const first = cloneBlockWithNewIds(hero);
    const second = cloneBlockWithNewIds(hero);

    expect(first.id).not.toBe(second.id);
  });
});

describe('createBlockFromDescriptor', () => {
  const heroDescriptor: BlockDescriptor = {
    type: 'Hero',
    label: 'Hero',
    category: 'content',
    defaultProps: { title: 'Titolo' },
    fields: [],
  };
  const containerDescriptor: BlockDescriptor = {
    type: 'Container',
    label: 'Contenitore',
    category: 'layout',
    defaultProps: {},
    fields: [],
    isContainer: true,
  };
  const columnDescriptor: BlockDescriptor = {
    type: 'Column',
    label: 'Colonna',
    category: 'layout',
    defaultProps: {},
    fields: [],
    isContainer: true,
  };
  const columnsDescriptor: BlockDescriptor = {
    type: 'Columns',
    label: 'Colonne',
    category: 'layout',
    defaultProps: { layout: 'two-equal' },
    fields: [],
    isContainer: true,
    allowedChildTypes: ['Column'],
  };
  const testimonialDescriptor: BlockDescriptor = {
    type: 'Testimonial',
    label: 'Testimonianza',
    category: 'socialProof',
    defaultProps: { quote: 'Testo della recensione...' },
    fields: [],
  };
  const testimonialsDescriptor: BlockDescriptor = {
    type: 'Testimonials',
    label: 'Testimonianze/recensioni',
    category: 'socialProof',
    defaultProps: {},
    fields: [],
    isContainer: true,
    allowedChildTypes: ['Testimonial'],
  };
  const registry = [
    heroDescriptor,
    containerDescriptor,
    columnDescriptor,
    columnsDescriptor,
    testimonialDescriptor,
    testimonialsDescriptor,
  ];

  it('gives a non-container block its default props and a fresh id, no children key', () => {
    const block = createBlockFromDescriptor(heroDescriptor, registry);

    expect(block.type).toBe('Hero');
    expect(block.props).toEqual({ title: 'Titolo' });
    expect(block.id).toBeTruthy();
    expect(block.children).toBeUndefined();
  });

  it('leaves a generic container (no allowedChildTypes) empty — there is no single canonical child to seed', () => {
    const block = createBlockFromDescriptor(containerDescriptor, registry);

    expect(block.children).toEqual([]);
  });

  it('seeds a "collection" container (exactly one allowedChildTypes entry) with one child of that type, using the child descriptor\'s own default props', () => {
    const block = createBlockFromDescriptor(testimonialsDescriptor, registry);

    expect(block.children).toHaveLength(1);
    expect(block.children?.[0]).toMatchObject({
      type: 'Testimonial',
      props: { quote: 'Testo della recensione...' },
    });
    expect(block.children?.[0].id).toBeTruthy();
  });

  it('seeds Columns with one Column per track of its default layout (two-equal → 2)', () => {
    const block = createBlockFromDescriptor(columnsDescriptor, registry);

    expect(block.children).toHaveLength(2);
    expect(block.children?.every((child) => child.type === 'Column')).toBe(
      true,
    );
  });

  it('seeds Columns with 3 columns for the three-equal layout', () => {
    const threeColumnsDescriptor: BlockDescriptor = {
      ...columnsDescriptor,
      defaultProps: { layout: 'three-equal' },
    };

    const block = createBlockFromDescriptor(threeColumnsDescriptor, registry);

    expect(block.children).toHaveLength(3);
  });

  it('gives each seeded Column a distinct id, and leaves it empty (a Column has no canonical child of its own)', () => {
    const block = createBlockFromDescriptor(columnsDescriptor, registry);
    const [first, second] = block.children ?? [];

    expect(first?.id).not.toBe(second?.id);
    expect(first?.children).toEqual([]);
  });

  it('leaves the container empty (instead of throwing) if its declared child type is missing from the registry', () => {
    const orphanDescriptor: BlockDescriptor = {
      type: 'Orphan',
      label: 'Orfano',
      category: 'content',
      defaultProps: {},
      fields: [],
      isContainer: true,
      allowedChildTypes: ['Ghost'],
    };

    const block = createBlockFromDescriptor(orphanDescriptor, [
      orphanDescriptor,
    ]);

    expect(block.children).toEqual([]);
  });
});
