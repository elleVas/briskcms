import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Block } from '@brisk/shared-types';
import { computeNestedReorder, LayersPanel } from './layers-panel';

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

  it('renders one row per top-level block, labeled by type', () => {
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
    expect(rows[1].textContent).toBe('Text');
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
    expect(rows[1].textContent).toBe('Text');
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

    expect(onSelect).toHaveBeenCalledWith('text-1');
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
    expect(onSelect).toHaveBeenLastCalledWith('column-1');

    fireEvent.click(rows[1]); // "gallery-1"
    expect(onSelect).toHaveBeenLastCalledWith('gallery-1');
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
