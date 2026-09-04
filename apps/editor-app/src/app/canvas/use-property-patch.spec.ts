import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as blockFragmentApi from '../../lib/block-fragment-api-client';
import { usePropertyPatch } from './use-property-patch';

vi.mock('../../lib/block-fragment-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../lib/block-fragment-api-client')
    >();
  return { ...actual, renderBlockFragment: vi.fn() };
});

describe('usePropertyPatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  function setup(debounceMs = 300) {
    const onSaveDraft = vi.fn();
    const onSaveStyleOverride = vi.fn();
    const patchBlock = vi.fn();
    const { result } = renderHook(() =>
      usePropertyPatch({
        pageId: 'page-1',
        token: 'tok',
        onSaveDraft,
        onSaveStyleOverride,
        patchBlock,
        debounceMs,
      }),
    );
    return { result, onSaveDraft, onSaveStyleOverride, patchBlock };
  }

  it('does nothing before the debounce window elapses', () => {
    const { result, onSaveDraft } = setup();

    act(() => {
      result.current.scheduleChange('hero-1', 'Hero', 'title', {
        title: 'New',
      });
    });
    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(onSaveDraft).not.toHaveBeenCalled();
  });

  it('saves the draft and renders+patches the fragment once the debounce elapses', async () => {
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<div>patched</div>',
    );
    const { result, onSaveDraft, patchBlock } = setup();

    act(() => {
      result.current.scheduleChange('hero-1', 'Hero', 'title', {
        title: 'New',
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    // Deja passare la microtask della Promise risolta dentro il timer.
    await act(async () => {
      await Promise.resolve();
    });

    expect(onSaveDraft).toHaveBeenCalledWith('hero-1', 'title', {
      title: 'New',
    });
    expect(blockFragmentApi.renderBlockFragment).toHaveBeenCalledWith({
      pageId: 'page-1',
      token: 'tok',
      blockId: 'hero-1',
      blockType: 'Hero',
      props: { title: 'New' },
    });
    expect(patchBlock).toHaveBeenCalledWith('hero-1', '<div>patched</div>');
  });

  it('resets the debounce timer on a rapid second change to the same block', () => {
    const { result, onSaveDraft } = setup();

    act(() => {
      result.current.scheduleChange('hero-1', 'Hero', 'title', { title: 'A' });
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.scheduleChange('hero-1', 'Hero', 'title', { title: 'AB' });
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // The first timer was cancelled by the second change — only 400ms in
    // total have passed since the SECOND change (200ms), not yet the 300ms.
    expect(onSaveDraft).not.toHaveBeenCalled();
  });

  it('tracks each block id with its own independent timer', () => {
    const { result, onSaveDraft } = setup();

    act(() => {
      result.current.scheduleChange('hero-1', 'Hero', 'title', { title: 'A' });
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    act(() => {
      result.current.scheduleChange('text-1', 'Text', 'body', { body: 'B' });
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // hero-1's own 300ms have elapsed (150 + 150); text-1's own 150ms have not.
    expect(onSaveDraft).toHaveBeenCalledWith('hero-1', 'title', { title: 'A' });
    expect(onSaveDraft).not.toHaveBeenCalledWith('text-1', 'body', {
      body: 'B',
    });
  });

  it('scheduleTextChange saves the draft after its own debounce, without touching render-block-fragment', async () => {
    const { result, onSaveDraft, patchBlock } = setup();

    act(() => {
      result.current.scheduleTextChange('hero-1', 'title', 'Nuovo titolo');
    });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(onSaveDraft).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(onSaveDraft).toHaveBeenCalledWith('hero-1', 'title', {
      title: 'Nuovo titolo',
    });
    expect(blockFragmentApi.renderBlockFragment).not.toHaveBeenCalled();
    expect(patchBlock).not.toHaveBeenCalled();
  });

  it('scheduleChange and scheduleTextChange on the same block have independent timers', () => {
    const { result, onSaveDraft } = setup();

    act(() => {
      result.current.scheduleChange('hero-1', 'Hero', 'title', {
        title: 'Prop change',
      });
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.scheduleTextChange('hero-1', 'subtitle', 'Text change');
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // scheduleChange's own 300ms have elapsed (200 + 100); scheduleTextChange's
    // own 100ms have not — the two timers didn't reset each other.
    expect(onSaveDraft).toHaveBeenCalledWith('hero-1', 'title', {
      title: 'Prop change',
    });
    expect(onSaveDraft).not.toHaveBeenCalledWith('hero-1', 'subtitle', {
      subtitle: 'Text change',
    });
  });

  it('still saves the draft even when renderBlockFragment rejects', async () => {
    vi.mocked(blockFragmentApi.renderBlockFragment).mockRejectedValue(
      new Error('boom'),
    );
    const { result, onSaveDraft, patchBlock } = setup();

    act(() => {
      result.current.scheduleChange('hero-1', 'Hero', 'title', {
        title: 'New',
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onSaveDraft).toHaveBeenCalledWith('hero-1', 'title', {
      title: 'New',
    });
    expect(patchBlock).not.toHaveBeenCalled();
  });

  it('flushAll fires every pending save immediately, without waiting out its debounce', () => {
    const { result, onSaveDraft } = setup();

    act(() => {
      result.current.scheduleChange('hero-1', 'Hero', 'title', { title: 'A' });
      result.current.scheduleTextChange('text-1', 'body', 'B');
    });
    expect(onSaveDraft).not.toHaveBeenCalled();

    act(() => {
      result.current.flushAll();
    });

    expect(onSaveDraft).toHaveBeenCalledWith('hero-1', 'title', { title: 'A' });
    expect(onSaveDraft).toHaveBeenCalledWith('text-1', 'body', { body: 'B' });
  });

  it('flushAll does nothing when nothing is pending', () => {
    const { result, onSaveDraft } = setup();

    act(() => {
      result.current.flushAll();
    });

    expect(onSaveDraft).not.toHaveBeenCalled();
  });

  it("a change scheduled again after flushAll gets its own fresh debounce window (flushAll doesn't leave a stale timer key behind)", () => {
    const { result, onSaveDraft } = setup();

    act(() => {
      result.current.scheduleChange('hero-1', 'Hero', 'title', { title: 'A' });
      result.current.flushAll();
      result.current.scheduleChange('hero-1', 'Hero', 'title', { title: 'B' });
    });
    expect(onSaveDraft).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onSaveDraft).toHaveBeenCalledTimes(2);
    expect(onSaveDraft).toHaveBeenLastCalledWith('hero-1', 'title', {
      title: 'B',
    });
  });

  it('scheduleStyleOverrideChange saves the override and renders+patches the fragment once the debounce elapses', async () => {
    vi.mocked(blockFragmentApi.renderBlockFragment).mockResolvedValue(
      '<div>patched</div>',
    );
    const { result, onSaveStyleOverride, patchBlock } = setup();

    act(() => {
      result.current.scheduleStyleOverrideChange(
        'button-1',
        'Button',
        { label: 'Clicca qui' },
        { backgroundColor: '#ff0000' },
      );
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onSaveStyleOverride).toHaveBeenCalledWith('button-1', {
      backgroundColor: '#ff0000',
    });
    expect(blockFragmentApi.renderBlockFragment).toHaveBeenCalledWith({
      pageId: 'page-1',
      token: 'tok',
      blockId: 'button-1',
      blockType: 'Button',
      props: { label: 'Clicca qui' },
      children: undefined,
      styleOverride: { backgroundColor: '#ff0000' },
    });
    expect(patchBlock).toHaveBeenCalledWith('button-1', '<div>patched</div>');
  });

  it('scheduleChange and scheduleStyleOverrideChange on the same block have independent timers', () => {
    const { result, onSaveDraft, onSaveStyleOverride } = setup();

    act(() => {
      result.current.scheduleChange('button-1', 'Button', 'label', {
        label: 'Prop change',
      });
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.scheduleStyleOverrideChange(
        'button-1',
        'Button',
        { label: 'Prop change' },
        { backgroundColor: '#ff0000' },
      );
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onSaveDraft).toHaveBeenCalledWith('button-1', 'label', {
      label: 'Prop change',
    });
    expect(onSaveStyleOverride).not.toHaveBeenCalled();
  });
});
