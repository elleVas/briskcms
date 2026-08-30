import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import * as blockFragmentApi from '../../lib/block-fragment-api-client';
import { useBlockTreeMutations } from './use-block-tree-mutations';

vi.mock('../../lib/block-fragment-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../lib/block-fragment-api-client')
    >();
  return { ...actual, renderBlockFragment: vi.fn() };
});

const heroDescriptor: BlockDescriptor = {
  type: 'Hero',
  label: 'Hero',
  category: 'content',
  defaultProps: { title: 'Titolo' },
  fields: [],
};

function setup(localBlocks: Block[]) {
  const onChange = vi.fn();
  const setLocalBlocks = vi.fn();
  const bridge = {
    selectedBlockId: null,
    patchBlock: vi.fn(),
    insertBlock: vi.fn(),
    removeBlock: vi.fn(),
    reorderBlocks: vi.fn(),
  };
  const { result, rerender } = renderHook(
    (props: { localBlocks: Block[]; selectedBlock: Block | null }) =>
      useBlockTreeMutations({
        localBlocks: props.localBlocks,
        setLocalBlocks,
        onChange,
        registry: [heroDescriptor],
        bridge,
        token: 'tok',
        pageId: 'page-1',
        selectedBlock: props.selectedBlock,
        selectedDescriptor: props.selectedBlock ? heroDescriptor : undefined,
      }),
    {
      initialProps: {
        localBlocks,
        selectedBlock: null as Block | null,
      },
    },
  );
  return { result, rerender, onChange, setLocalBlocks, bridge };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useBlockTreeMutations undo/redo', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts with nothing to undo or redo', () => {
    const { result } = setup([]);

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo after a root insert removes the block from the canvas and restores the local tree', async () => {
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<div>hero</div>',
    );
    const { result, onChange, bridge } = setup([]);

    act(() => {
      result.current.handleInsert(heroDescriptor);
    });
    await flush();
    expect(result.current.canUndo).toBe(true);
    onChange.mockClear();

    act(() => {
      result.current.undo();
    });

    expect(onChange).toHaveBeenCalledWith([]);
    expect(bridge.removeBlock).toHaveBeenCalled();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redo after undoing an insert re-inserts the exact same block into the canvas', async () => {
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<div>hero</div>',
    );
    const { result, bridge } = setup([]);

    act(() => {
      result.current.handleInsert(heroDescriptor);
    });
    await flush();
    act(() => {
      result.current.undo();
    });
    bridge.insertBlock.mockClear();

    act(() => {
      result.current.redo();
    });
    await flush();

    expect(bridge.insertBlock).toHaveBeenCalledWith(
      '<div>hero</div>',
      null,
      null,
    );
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo after removing a root block re-inserts it at its original position', async () => {
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<div>hero</div>',
    );
    const heroBlock: Block = { id: 'hero-1', type: 'Hero', props: {} };
    const textBlock: Block = { id: 'text-1', type: 'Text', props: {} };
    const { result, rerender, onChange, bridge } = setup([
      heroBlock,
      textBlock,
    ]);
    rerender({ localBlocks: [heroBlock, textBlock], selectedBlock: heroBlock });

    act(() => {
      result.current.handleRemoveSelected();
    });
    expect(onChange).toHaveBeenCalledWith([textBlock]);
    onChange.mockClear();

    act(() => {
      result.current.undo();
    });
    await flush();

    expect(onChange).toHaveBeenCalledWith([heroBlock, textBlock]);
    // Reinserted before text-1 — its original next sibling.
    expect(bridge.insertBlock).toHaveBeenCalledWith(
      '<div>hero</div>',
      null,
      'text-1',
    );
  });

  it('undo after moving a block back restores its original index and canvas order', () => {
    const heroBlock: Block = { id: 'hero-1', type: 'Hero', props: {} };
    const textBlock: Block = { id: 'text-1', type: 'Text', props: {} };
    const { result, rerender, onChange, bridge } = setup([
      heroBlock,
      textBlock,
    ]);
    rerender({ localBlocks: [heroBlock, textBlock], selectedBlock: heroBlock });

    act(() => {
      result.current.handleMoveSelected(1);
    });
    expect(bridge.reorderBlocks).toHaveBeenCalledWith(null, [
      'text-1',
      'hero-1',
    ]);
    bridge.reorderBlocks.mockClear();
    onChange.mockClear();

    act(() => {
      result.current.undo();
    });

    expect(onChange).toHaveBeenCalledWith([heroBlock, textBlock]);
    expect(bridge.reorderBlocks).toHaveBeenCalledWith(null, [
      'hero-1',
      'text-1',
    ]);
  });

  it('a new action after an undo clears the redo stack', async () => {
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<div>hero</div>',
    );
    const { result } = setup([]);

    act(() => {
      result.current.handleInsert(heroDescriptor);
    });
    await flush();
    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.handleInsert(heroDescriptor);
    });
    await flush();

    expect(result.current.canRedo).toBe(false);
  });

  it('undo does nothing when there is no history', () => {
    const { result, onChange } = setup([]);

    act(() => {
      result.current.undo();
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('redo does nothing when there is nothing to redo', () => {
    const { result, onChange } = setup([]);

    act(() => {
      result.current.redo();
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
