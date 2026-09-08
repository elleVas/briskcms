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
    selectedBlockIds: [],
    patchBlock: vi.fn(),
    insertBlock: vi.fn(),
    removeBlock: vi.fn(),
    reorderBlocks: vi.fn(),
  };
  const { result, rerender } = renderHook(
    (props: {
      localBlocks: Block[];
      selectedBlock: Block | null;
      pageId?: string;
    }) =>
      useBlockTreeMutations({
        localBlocks: props.localBlocks,
        setLocalBlocks,
        onChange,
        registry: [heroDescriptor],
        bridge,
        token: 'tok',
        pageId: props.pageId ?? 'page-1',
        selectedBlock: props.selectedBlock,
        selectedDescriptor: props.selectedBlock ? heroDescriptor : undefined,
      }),
    {
      initialProps: {
        localBlocks,
        selectedBlock: null as Block | null,
        pageId: 'page-1',
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
    rerender({
      localBlocks: [heroBlock, textBlock],
      selectedBlock: heroBlock,
      pageId: 'page-1',
    });

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
    rerender({
      localBlocks: [heroBlock, textBlock],
      selectedBlock: heroBlock,
      pageId: 'page-1',
    });

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

  it('handleReorder(null, ...) reorders root blocks and syncs the canvas', () => {
    const heroBlock: Block = { id: 'hero-1', type: 'Hero', props: {} };
    const textBlock: Block = { id: 'text-1', type: 'Text', props: {} };
    const { result, onChange, bridge } = setup([heroBlock, textBlock]);

    act(() => {
      result.current.handleReorder(null, ['text-1', 'hero-1']);
    });

    expect(onChange).toHaveBeenCalledWith([textBlock, heroBlock]);
    expect(bridge.reorderBlocks).toHaveBeenCalledWith(null, [
      'text-1',
      'hero-1',
    ]);
  });

  it('handleReorder(containerId, ...) reorders nested children only, leaving root order untouched', () => {
    const childA: Block = { id: 'child-a', type: 'Text', props: {} };
    const childB: Block = { id: 'child-b', type: 'Text', props: {} };
    const container: Block = {
      id: 'container-1',
      type: 'Container',
      props: {},
      children: [childA, childB],
    };
    const sibling: Block = { id: 'sibling-1', type: 'Hero', props: {} };
    const { result, onChange, bridge } = setup([container, sibling]);

    act(() => {
      result.current.handleReorder('container-1', ['child-b', 'child-a']);
    });

    expect(onChange).toHaveBeenCalledWith([
      { ...container, children: [childB, childA] },
      sibling,
    ]);
    expect(bridge.reorderBlocks).toHaveBeenCalledWith('container-1', [
      'child-b',
      'child-a',
    ]);
  });

  it('undo after a nested reorder restores the original child order and canvas sync', () => {
    const childA: Block = { id: 'child-a', type: 'Text', props: {} };
    const childB: Block = { id: 'child-b', type: 'Text', props: {} };
    const container: Block = {
      id: 'container-1',
      type: 'Container',
      props: {},
      children: [childA, childB],
    };
    const { result, onChange, bridge } = setup([container]);

    act(() => {
      result.current.handleReorder('container-1', ['child-b', 'child-a']);
    });
    bridge.reorderBlocks.mockClear();
    onChange.mockClear();

    act(() => {
      result.current.undo();
    });

    expect(onChange).toHaveBeenCalledWith([container]);
    expect(bridge.reorderBlocks).toHaveBeenCalledWith('container-1', [
      'child-a',
      'child-b',
    ]);
  });

  // recordEdit exists for the changes this hook does NOT own: a typed
  // character, an Inspector field, a colour in the style popover. The tree
  // is mutated by canvas-editor-shell, which then hands both sides here.
  it('undo after a property edit restores the tree and re-patches the canvas with the old props', async () => {
    const before: Block[] = [
      { id: 'a', type: 'Hero', props: { title: 'old' } },
    ];
    const after: Block[] = [{ id: 'a', type: 'Hero', props: { title: 'new' } }];
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<section>old</section>',
    );
    // Mounted on `before`: that IS the baseline the history starts from,
    // which is the whole point — the caller no longer supplies it.
    const { result, setLocalBlocks, onChange, bridge } = setup(before);

    act(() => result.current.recordEdit('a', after));
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    await flush();

    expect(setLocalBlocks).toHaveBeenCalledWith(before);
    expect(onChange).toHaveBeenCalledWith(before);
    expect(blockFragmentApi.renderBlockFragment).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'a', props: { title: 'old' } }),
    );
    expect(bridge.patchBlock).toHaveBeenCalledWith(
      'a',
      '<section>old</section>',
    );
  });

  it('redo after undoing a property edit patches the canvas back to the new props', async () => {
    const before: Block[] = [
      { id: 'a', type: 'Hero', props: { title: 'old' } },
    ];
    const after: Block[] = [{ id: 'a', type: 'Hero', props: { title: 'new' } }];
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<i></i>',
    );
    const { result, onChange } = setup(before);

    act(() => result.current.recordEdit('a', after));
    act(() => result.current.undo());
    await flush();
    vi.mocked(blockFragmentApi.renderBlockFragment).mockClear();

    act(() => result.current.redo());
    await flush();

    expect(onChange).toHaveBeenLastCalledWith(after);
    expect(blockFragmentApi.renderBlockFragment).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'a', props: { title: 'new' } }),
    );
  });

  // The per-instance style override travels on the block, so it rides the
  // same entry as a property change rather than needing one of its own.
  it('carries a per-instance style override through undo', async () => {
    const before: Block[] = [{ id: 'a', type: 'Hero', props: {} }];
    const after: Block[] = [
      {
        id: 'a',
        type: 'Hero',
        props: {},
        styleOverride: { base: { textColor: '#f00' } },
      },
    ];
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<i></i>',
    );
    const { result } = setup(before);

    act(() => result.current.recordEdit('a', after));
    act(() => result.current.undo());
    await flush();

    expect(blockFragmentApi.renderBlockFragment).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: 'a', styleOverride: undefined }),
    );
  });

  // The shell does NOT remount when you switch language: it resyncs
  // localBlocks from props and keeps every other piece of state. So the
  // history has to notice the page changed under it, or undo reaches back
  // into the previous translation — and since undo also calls onChange,
  // that tree gets SAVED over the current one.
  it('drops the history when the page changes, instead of undoing into the other page', async () => {
    const italian: Block[] = [
      { id: 'a', type: 'Hero', props: { title: 'Ciao' } },
    ];
    const edited: Block[] = [
      { id: 'a', type: 'Hero', props: { title: 'Ciao a tutti' } },
    ];
    const english: Block[] = [
      { id: 'a', type: 'Hero', props: { title: 'Hello' } },
    ];
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<i></i>',
    );
    const { result, rerender, onChange } = setup(italian);

    act(() => result.current.recordEdit('a', edited));
    expect(result.current.canUndo).toBe(true);

    // Switching language: a different pageId, and the shell has already
    // swapped localBlocks for the other translation's tree.
    rerender({ localBlocks: english, selectedBlock: null, pageId: 'page-2' });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.undo());
    await flush();
    expect(onChange).not.toHaveBeenCalledWith(italian);
  });

  // Same reset, seen from the other side: after the switch the history
  // starts again from the NEW page's tree, so the first edit there is
  // undoable back to it and not to something belonging to the old page.
  it('re-baselines on the new page, so the first edit there undoes correctly', async () => {
    const italian: Block[] = [
      { id: 'a', type: 'Hero', props: { title: 'Ciao' } },
    ];
    const english: Block[] = [
      { id: 'a', type: 'Hero', props: { title: 'Hello' } },
    ];
    const englishEdited: Block[] = [
      { id: 'a', type: 'Hero', props: { title: 'Hello world' } },
    ];
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<i></i>',
    );
    const { result, rerender, onChange } = setup(italian);

    rerender({ localBlocks: english, selectedBlock: null, pageId: 'page-2' });
    act(() => result.current.recordEdit('a', englishEdited));
    act(() => result.current.undo());
    await flush();

    expect(onChange).toHaveBeenLastCalledWith(english);
  });

  // An edit is one entry however many keystrokes produced it, so undoing a
  // structural change after typing must not be swallowed by the text.
  it('interleaves edits and structural mutations in one history', async () => {
    const before: Block[] = [
      { id: 'a', type: 'Hero', props: { title: 'old' } },
    ];
    const after: Block[] = [{ id: 'a', type: 'Hero', props: { title: 'new' } }];
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<i></i>',
    );
    const { result, rerender, onChange } = setup(before);

    act(() => result.current.recordEdit('a', after));
    rerender({ localBlocks: after, selectedBlock: after[0], pageId: 'page-1' });
    act(() => result.current.handleRemoveSelected());
    await flush();

    act(() => result.current.undo());
    await flush();
    expect(onChange).toHaveBeenLastCalledWith(after);

    act(() => result.current.undo());
    await flush();
    expect(onChange).toHaveBeenLastCalledWith(before);
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
