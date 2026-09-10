import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Block } from '@brisk/shared-types';
import {
  LayersPanel,
  computeNestedReorder,
  computeReparent,
} from './layers-panel';

describe('computeNestedReorder', () => {
  it('moves the active block to the position of the over block, among root siblings', () => {
    const blocks: Block[] = [
      { id: 'a', type: 'Text', props: {} },
      { id: 'b', type: 'Text', props: {} },
      { id: 'c', type: 'Text', props: {} },
    ];
    expect(computeNestedReorder(blocks, 'a', 'c')).toEqual({
      parentId: null,
      orderedIds: ['b', 'c', 'a'],
    });
  });

  it('moves the active block among its nested siblings, inside the same container', () => {
    const blocks: Block[] = [
      {
        id: 'container-1',
        type: 'Container',
        props: {},
        children: [
          { id: 'child-a', type: 'Text', props: {} },
          { id: 'child-b', type: 'Text', props: {} },
          { id: 'child-c', type: 'Text', props: {} },
        ],
      },
    ];
    expect(computeNestedReorder(blocks, 'child-a', 'child-c')).toEqual({
      parentId: 'container-1',
      orderedIds: ['child-b', 'child-c', 'child-a'],
    });
  });

  it('returns null when dropped on itself', () => {
    const blocks: Block[] = [
      { id: 'a', type: 'Text', props: {} },
      { id: 'b', type: 'Text', props: {} },
    ];
    expect(computeNestedReorder(blocks, 'a', 'a')).toBeNull();
  });

  it('returns null when there is no drop target', () => {
    const blocks: Block[] = [{ id: 'a', type: 'Text', props: {} }];
    expect(computeNestedReorder(blocks, 'a', null)).toBeNull();
  });

  it('returns null for a block id not present in the tree', () => {
    const blocks: Block[] = [{ id: 'a', type: 'Text', props: {} }];
    expect(computeNestedReorder(blocks, 'a', 'ghost')).toBeNull();
  });

  it("rejects a drop across different parents (reparenting via drag isn't supported)", () => {
    const blocks: Block[] = [
      { id: 'root-a', type: 'Text', props: {} },
      {
        id: 'container-1',
        type: 'Container',
        props: {},
        children: [{ id: 'child-a', type: 'Text', props: {} }],
      },
    ];
    expect(computeNestedReorder(blocks, 'root-a', 'child-a')).toBeNull();
  });

  it('rejects a drop between children of two different containers, even at the same depth', () => {
    const blocks: Block[] = [
      {
        id: 'container-1',
        type: 'Container',
        props: {},
        children: [{ id: 'child-a', type: 'Text', props: {} }],
      },
      {
        id: 'container-2',
        type: 'Container',
        props: {},
        children: [{ id: 'child-b', type: 'Text', props: {} }],
      },
    ];
    expect(computeNestedReorder(blocks, 'child-a', 'child-b')).toBeNull();
  });
});

describe('LayersPanel', () => {
  it('renders nothing for an empty page', () => {
    const { container } = render(
      <LayersPanel
        blocks={[]}
        hoveredBlockId={null}
        selectedBlockId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  /*
   * By the name a person picked the block by, not by its type. The tree
   * used to read `FeatureGrid` and `EmbedHtml` — our words for it, in a
   * panel meant for somebody arranging a page. Every block already had a
   * translated label; the panel simply was not asking for it.
   */
  it('renders one row per top-level block, named the way a person picked it', () => {
    const blocks: Block[] = [
      { id: 'hero-1', type: 'Hero', props: {} },
      { id: 'text-1', type: 'Text', props: {} },
    ];
    render(
      <LayersPanel
        blocks={blocks}
        hoveredBlockId={null}
        selectedBlockId={null}
        onSelect={vi.fn()}
      />,
    );

    const rows = screen.getAllByTestId('layer-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toBe('Hero');
    expect(rows[1].textContent).toBe('Testo');
  });

  it('renders nested children indented under their container', () => {
    const blocks: Block[] = [
      {
        id: 'container-1',
        type: 'Container',
        props: {},
        children: [{ id: 'text-1', type: 'Text', props: {} }],
      },
    ];
    render(
      <LayersPanel
        blocks={blocks}
        hoveredBlockId={null}
        selectedBlockId={null}
        onSelect={vi.fn()}
      />,
    );

    const rows = screen.getAllByTestId('layer-row');
    expect(rows).toHaveLength(2);
    expect(rows[1].textContent).toBe('Testo');
  });

  /*
   * Indentation alone stopped being readable at the third level:
   * `Columns > Column > Code` was three rows at three margins, and which
   * Column the Code belonged to was a guess. The guides answer that
   * without being read — and the line under the LAST child has to stop
   * at its elbow, or the tree draws a branch continuing past its end.
   */
  /*
   * Right-clicking a row selects it first, and NOT additively: the menu
   * acts on the selection, so deleting from one row must not take
   * whatever happened to be selected before it as well.
   */
  it('selects the row it was opened on, on its own, before offering a menu', () => {
    const onSelect = vi.fn();
    const onContextMenu = vi.fn();
    render(
      <LayersPanel
        blocks={[
          { id: 'hero-1', type: 'Hero', props: {} },
          { id: 'text-1', type: 'Text', props: {} },
        ]}
        hoveredBlockId={null}
        selectedBlockId="hero-1"
        onSelect={onSelect}
        onContextMenu={onContextMenu}
      />,
    );

    fireEvent.contextMenu(screen.getAllByTestId('layer-row')[1]!, {
      clientX: 120,
      clientY: 240,
    });

    expect(onSelect).toHaveBeenCalledWith('text-1', false);
    expect(onContextMenu).toHaveBeenCalledWith('text-1', 120, 240);
  });

  it('draws a guide for every branch a row sits under, and ends the one it closes', () => {
    const blocks: Block[] = [
      {
        id: 'columns-1',
        type: 'Columns',
        props: {},
        children: [
          { id: 'col-1', type: 'Column', props: {} },
          { id: 'col-2', type: 'Column', props: {} },
        ],
      },
    ];
    const { container } = render(
      <LayersPanel
        blocks={blocks}
        hoveredBlockId={null}
        selectedBlockId={null}
        onSelect={vi.fn()}
      />,
    );

    const items = [...container.querySelectorAll('li')];
    const guides = (li: Element) =>
      [...li.children].filter(
        (child) =>
          child.tagName === 'SPAN' && child.hasAttribute('aria-hidden'),
      );

    // The container is at the root: nothing above it to connect to.
    expect(guides(items[0]!)).toHaveLength(0);
    // Each child gets its branch line plus the elbow into it.
    expect(guides(items[1]!)).toHaveLength(2);
    expect(guides(items[2]!)).toHaveLength(2);
    // ...and the last child's line stops halfway, at the elbow.
    const lastBranchLine = guides(items[2]!)[0] as HTMLElement;
    expect(lastBranchLine.style.height).not.toBe('');
  });

  it('marks the hovered row distinctly from an idle one', () => {
    const blocks: Block[] = [{ id: 'hero-1', type: 'Hero', props: {} }];
    render(
      <LayersPanel
        blocks={blocks}
        hoveredBlockId="hero-1"
        selectedBlockId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId('layer-row').getAttribute('data-state')).toBe(
      'hovered',
    );
  });

  it('still renders every row (non-orderable) when a block is missing an id', () => {
    const blocks: Block[] = [
      { type: 'Hero', props: {} },
      { id: 'text-1', type: 'Text', props: {} },
    ];
    render(
      <LayersPanel
        blocks={blocks}
        hoveredBlockId={null}
        selectedBlockId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('layer-row')).toHaveLength(2);
  });

  it('marks the selected row distinctly from a merely hovered one', () => {
    const blocks: Block[] = [{ id: 'hero-1', type: 'Hero', props: {} }];
    render(
      <LayersPanel
        blocks={blocks}
        hoveredBlockId="hero-1"
        selectedBlockId="hero-1"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId('layer-row').getAttribute('data-state')).toBe(
      'selected',
    );
  });

  it('clicking a top-level row selects that block — the reliable way to select a container fully covered by a child on the canvas', () => {
    const blocks: Block[] = [
      { id: 'hero-1', type: 'Hero', props: {} },
      { id: 'text-1', type: 'Text', props: {} },
    ];
    const onSelect = vi.fn();
    render(
      <LayersPanel
        blocks={blocks}
        hoveredBlockId={null}
        selectedBlockId={null}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getAllByTestId('layer-row')[1]);

    expect(onSelect).toHaveBeenCalledWith('text-1', false);
  });

  it('clicking a nested row selects the CHILD, not its parent container', () => {
    const blocks: Block[] = [
      {
        id: 'column-1',
        type: 'Column',
        props: {},
        children: [{ id: 'gallery-1', type: 'Gallery', props: {} }],
      },
    ];
    const onSelect = vi.fn();
    render(
      <LayersPanel
        blocks={blocks}
        hoveredBlockId={null}
        selectedBlockId={null}
        onSelect={onSelect}
      />,
    );

    const rows = screen.getAllByTestId('layer-row');
    fireEvent.click(rows[0]); // "column-1"
    expect(onSelect).toHaveBeenLastCalledWith('column-1', false);

    fireEvent.click(rows[1]); // "gallery-1"
    expect(onSelect).toHaveBeenLastCalledWith('gallery-1', false);
  });

  it('a container with children shows an expand/collapse chevron, a leaf block does not', () => {
    const blocks: Block[] = [
      {
        id: 'container-1',
        type: 'Container',
        props: {},
        children: [{ id: 'text-1', type: 'Text', props: {} }],
      },
      { id: 'hero-1', type: 'Hero', props: {} },
    ];
    render(
      <LayersPanel
        blocks={blocks}
        hoveredBlockId={null}
        selectedBlockId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button', { name: 'Comprimi' })).toHaveLength(1);
  });

  it('collapsing a container hides its nested rows without affecting selection', () => {
    const blocks: Block[] = [
      {
        id: 'container-1',
        type: 'Container',
        props: {},
        children: [{ id: 'text-1', type: 'Text', props: {} }],
      },
    ];
    const onSelect = vi.fn();
    render(
      <LayersPanel
        blocks={blocks}
        hoveredBlockId={null}
        selectedBlockId={null}
        onSelect={onSelect}
      />,
    );

    expect(screen.getAllByTestId('layer-row')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Comprimi' }));
    expect(screen.getAllByTestId('layer-row')).toHaveLength(1);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Espandi' }));
    expect(screen.getAllByTestId('layer-row')).toHaveLength(2);
  });

  it('a row for a block with no id is disabled and never calls onSelect', () => {
    const blocks: Block[] = [{ type: 'Hero', props: {} }];
    const onSelect = vi.fn();
    render(
      <LayersPanel
        blocks={blocks}
        hoveredBlockId={null}
        selectedBlockId={null}
        onSelect={onSelect}
      />,
    );

    const row = screen.getByTestId('layer-row') as HTMLButtonElement;
    expect(row.disabled).toBe(true);
    fireEvent.click(row);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

/*
 * Reparenting was impossible by construction: `computeNestedReorder`
 * refused every cross-parent drop, so moving a block into a Column meant
 * deleting it and building it again — losing its styling and its text.
 * These are the cases that decide whether the new path is safe.
 */
describe('computeReparent', () => {
  const tree: Block[] = [
    { id: 'hero', type: 'Hero', props: {} },
    { id: 'sibling', type: 'Text', props: {} },
    {
      id: 'cols',
      type: 'Columns',
      props: {},
      children: [
        { id: 'col-a', type: 'Column', props: {}, children: [] },
        {
          id: 'col-b',
          type: 'Column',
          props: {},
          children: [{ id: 'text', type: 'Text', props: {} }],
        },
      ],
    },
    { id: 'quotes', type: 'Testimonials', props: {}, children: [] },
  ];

  const CONTAINERS = new Set(['Columns', 'Column', 'Testimonials']);
  const options = {
    isContainerType: (type: string) => CONTAINERS.has(type),
    canContain: (parentType: string, childType: string) =>
      parentType === 'Testimonials' ? childType === 'Testimonial' : true,
  };

  /* An empty container has no child row to aim between — its own row is the only target. */
  it('drops a block inside an empty container, at the end', () => {
    expect(computeReparent(tree, 'hero', 'col-a', options)).toEqual({
      blockId: 'hero',
      parentId: 'col-a',
      index: 0,
    });
  });

  it('drops a block beside an ordinary row, becoming its sibling', () => {
    expect(computeReparent(tree, 'hero', 'text', options)).toEqual({
      blockId: 'hero',
      parentId: 'col-b',
      index: 0,
    });
  });

  /*
   * The one that would break a page rather than look wrong: a container
   * dropped inside itself detaches the whole subtree from the tree.
   */
  it('refuses a drop into its own subtree', () => {
    expect(computeReparent(tree, 'cols', 'col-a', options)).toBeNull();
    expect(computeReparent(tree, 'col-b', 'text', options)).toBeNull();
  });

  /* The same rule the drag-from-sidebar path already honours. */
  it('refuses a container that does not accept that type', () => {
    expect(computeReparent(tree, 'hero', 'quotes', options)).toBeNull();
  });

  /*
   * A same-parent drop between ordinary rows is a REORDER and belongs to
   * computeNestedReorder — answering it here too would give one gesture
   * two implementations.
   */
  it('refuses a same-parent drop between ordinary rows', () => {
    expect(computeReparent(tree, 'hero', 'sibling', options)).toBeNull();
  });

  /*
   * Dropping onto a CONTAINER's row always means "inside it", even when
   * the two are siblings — that is how a root block gets into a Columns,
   * and there is no other gesture for it.
   */
  it('puts a block inside a sibling container', () => {
    expect(computeReparent(tree, 'hero', 'cols', options)).toEqual({
      blockId: 'hero',
      parentId: 'cols',
      index: 2,
    });
  });

  it('refuses a drop on nothing, or on itself', () => {
    expect(computeReparent(tree, 'hero', null, options)).toBeNull();
    expect(computeReparent(tree, 'hero', 'hero', options)).toBeNull();
  });
});
