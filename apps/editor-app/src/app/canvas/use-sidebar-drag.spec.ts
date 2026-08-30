import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { useSidebarDrag } from './use-sidebar-drag';

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

const registry = [heroDescriptor, containerDescriptor];
const iframeGeometry = { top: 100, left: 50, width: 800, height: 600 };

function setup(
  overrides: {
    localBlocks?: Block[];
    rootRects?: { id: string; top: number; height: number }[];
    blockRects?: {
      id: string;
      top: number;
      left: number;
      width: number;
      height: number;
    }[];
  } = {},
) {
  const insertNewBlockAt = vi.fn();
  const { result } = renderHook(() =>
    useSidebarDrag({
      localBlocks: overrides.localBlocks ?? [],
      registry,
      iframeGeometry,
      rootRects: overrides.rootRects ?? [],
      blockRects: overrides.blockRects ?? [],
      insertNewBlockAt,
    }),
  );
  return { result, insertNewBlockAt };
}

describe('useSidebarDrag', () => {
  it('starts with no drag in progress', () => {
    const { result } = setup();

    expect(result.current.sidebarDrag).toBeNull();
  });

  it('handleSidebarDragStart begins tracking the descriptor at the origin', () => {
    const { result } = setup();

    act(() => {
      result.current.handleSidebarDragStart(heroDescriptor);
    });

    expect(result.current.sidebarDrag).toEqual({
      descriptor: heroDescriptor,
      pointerX: 0,
      pointerY: 0,
    });
  });

  it('handleSidebarDragMove updates the tracked pointer position', () => {
    const { result } = setup();
    act(() => {
      result.current.handleSidebarDragStart(heroDescriptor);
    });

    act(() => {
      result.current.handleSidebarDragMove(120, 340);
    });

    expect(result.current.sidebarDrag).toEqual({
      descriptor: heroDescriptor,
      pointerX: 120,
      pointerY: 340,
    });
  });

  it('handleSidebarDragMove does nothing when no drag is in progress', () => {
    const { result } = setup();

    act(() => {
      result.current.handleSidebarDragMove(120, 340);
    });

    expect(result.current.sidebarDrag).toBeNull();
  });

  it('handleSidebarDragEnd clears the drag state even when the drop misses the canvas', () => {
    const { result, insertNewBlockAt } = setup();
    act(() => {
      result.current.handleSidebarDragStart(heroDescriptor);
    });

    act(() => {
      // pageY below iframeGeometry.top — outside the canvas.
      result.current.handleSidebarDragEnd(heroDescriptor, 100, 10);
    });

    expect(result.current.sidebarDrag).toBeNull();
    expect(insertNewBlockAt).not.toHaveBeenCalled();
  });

  it('inserts at the root when dropped over the canvas but not over any container', () => {
    const { result, insertNewBlockAt } = setup({
      localBlocks: [{ id: 'text-1', type: 'Text', props: {} }],
      rootRects: [{ id: 'text-1', top: 0, height: 40 }],
    });

    act(() => {
      // pageX/pageY inside iframeGeometry bounds (left 50..850, top 100+).
      result.current.handleSidebarDragEnd(heroDescriptor, 400, 150);
    });

    expect(insertNewBlockAt).toHaveBeenCalledWith(
      heroDescriptor,
      expect.objectContaining({ parentId: null }),
    );
  });

  it('inserts as a child of the container under the drop point', () => {
    const containerBlock: Block = {
      id: 'container-1',
      type: 'Container',
      props: {},
      children: [],
    };
    const { result, insertNewBlockAt } = setup({
      localBlocks: [containerBlock],
      blockRects: [
        { id: 'container-1', top: 0, left: 0, width: 700, height: 500 },
      ],
    });

    // iframeX/Y = (pageX - left, pageY - top) = (350, 200), inside the
    // container rect above.
    act(() => {
      result.current.handleSidebarDragEnd(heroDescriptor, 400, 300);
    });

    expect(insertNewBlockAt).toHaveBeenCalledWith(heroDescriptor, {
      parentId: 'container-1',
      index: 0,
    });
  });
});
