import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Block } from '@brisk/shared-types';
import { computeReorderedIds, LayersPanel } from './layers-panel.js';

describe('computeReorderedIds', () => {
  it('moves the active id to the position of the over id', () => {
    expect(computeReorderedIds(['a', 'b', 'c'], 'a', 'c')).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  it('returns null when dropped on itself (no-op)', () => {
    expect(computeReorderedIds(['a', 'b', 'c'], 'a', 'a')).toBeNull();
  });

  it('returns null when there is no drop target', () => {
    expect(computeReorderedIds(['a', 'b', 'c'], 'a', null)).toBeNull();
  });

  it('returns null for an id not present in the list', () => {
    expect(computeReorderedIds(['a', 'b', 'c'], 'a', 'ghost')).toBeNull();
  });
});

describe('LayersPanel', () => {
  it('renders nothing for an empty page', () => {
    const { container } = render(
      <LayersPanel blocks={[]} hoveredBlockId={null} selectedBlockId={null} />,
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
      />,
    );

    expect(screen.getByTestId('layer-row').getAttribute('data-state')).toBe(
      'selected',
    );
  });
});
