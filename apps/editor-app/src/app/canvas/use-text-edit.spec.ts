import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Block } from '@brisk/shared-types';
import type { BlockDescriptor } from '@brisk/block-registry';
import { useTextEdit } from './use-text-edit.js';

const heroDescriptor: BlockDescriptor = {
  type: 'Hero',
  label: 'Hero',
  category: 'content',
  defaultProps: { title: 'Titolo' },
  fields: [
    { kind: 'text', key: 'title', label: 'Titolo', inlineEditable: true },
    { kind: 'text', key: 'subtitle', label: 'Sottotitolo' },
  ],
};

function buildBridge(
  overrides: Partial<Parameters<typeof useTextEdit>[0]['bridge']> = {},
) {
  return {
    lastTextChange: null,
    lastDblClick: null,
    enterTextEdit: vi.fn(),
    exitTextEdit: vi.fn(),
    ...overrides,
  };
}

function setup(bridge: ReturnType<typeof buildBridge>, blocks: Block[] = []) {
  const setLocalBlocks = vi.fn();
  const scheduleTextChange = vi.fn();
  const localBlocksRef = { current: blocks };
  const { rerender } = renderHook(
    (props: { bridge: ReturnType<typeof buildBridge> }) =>
      useTextEdit({
        bridge: props.bridge,
        registry: [heroDescriptor],
        localBlocksRef,
        setLocalBlocks,
        scheduleTextChange,
      }),
    { initialProps: { bridge } },
  );
  return { rerender, setLocalBlocks, scheduleTextChange };
}

describe('useTextEdit', () => {
  it('does nothing when there is no text change or double click', () => {
    const bridge = buildBridge();
    const { setLocalBlocks, scheduleTextChange } = setup(bridge);

    expect(setLocalBlocks).not.toHaveBeenCalled();
    expect(scheduleTextChange).not.toHaveBeenCalled();
  });

  it('applies a new lastTextChange optically and schedules the debounced save', () => {
    const bridge = buildBridge();
    const { rerender, setLocalBlocks, scheduleTextChange } = setup(bridge);

    const nextBridge = buildBridge({
      lastTextChange: { blockId: 'hero-1', field: 'title', text: 'Nuovo' },
    });
    rerender({ bridge: nextBridge });

    expect(setLocalBlocks).toHaveBeenCalledWith(expect.any(Function));
    expect(scheduleTextChange).toHaveBeenCalledWith('hero-1', 'title', 'Nuovo');
  });

  it('does not re-apply the same lastTextChange object twice', () => {
    const sameChange = { blockId: 'hero-1', field: 'title', text: 'Nuovo' };
    const bridge = buildBridge({ lastTextChange: sameChange });
    const { rerender, setLocalBlocks } = setup(bridge);
    setLocalBlocks.mockClear();

    rerender({ bridge: buildBridge({ lastTextChange: sameChange }) });

    expect(setLocalBlocks).not.toHaveBeenCalled();
  });

  it('enters text edit on a double click on an inlineEditable field', () => {
    const bridge = buildBridge();
    const blocks: Block[] = [{ id: 'hero-1', type: 'Hero', props: {} }];
    const { rerender } = setup(bridge, blocks);

    const nextBridge = buildBridge({
      lastDblClick: { blockId: 'hero-1', field: 'title' },
    });
    rerender({ bridge: nextBridge });

    expect(nextBridge.enterTextEdit).toHaveBeenCalledWith('hero-1', 'title');
  });

  it('does not enter text edit on a double click on a field that is not inlineEditable', () => {
    const bridge = buildBridge();
    const blocks: Block[] = [{ id: 'hero-1', type: 'Hero', props: {} }];
    const { rerender } = setup(bridge, blocks);

    const nextBridge = buildBridge({
      lastDblClick: { blockId: 'hero-1', field: 'subtitle' },
    });
    rerender({ bridge: nextBridge });

    expect(nextBridge.enterTextEdit).not.toHaveBeenCalled();
  });

  it('does not enter text edit when the double click carries no field (missed a real field)', () => {
    const bridge = buildBridge();
    const blocks: Block[] = [{ id: 'hero-1', type: 'Hero', props: {} }];
    const { rerender } = setup(bridge, blocks);

    const nextBridge = buildBridge({
      lastDblClick: { blockId: 'hero-1', field: null },
    });
    rerender({ bridge: nextBridge });

    expect(nextBridge.enterTextEdit).not.toHaveBeenCalled();
  });

  it('calls exitTextEdit on Escape', () => {
    const bridge = buildBridge();
    setup(bridge);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(bridge.exitTextEdit).toHaveBeenCalled();
  });

  it('does not call exitTextEdit on an unrelated key', () => {
    const bridge = buildBridge();
    setup(bridge);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(bridge.exitTextEdit).not.toHaveBeenCalled();
  });
});
