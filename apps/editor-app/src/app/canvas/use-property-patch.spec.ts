import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as blockFragmentApi from '../../lib/block-fragment-api-client.js';
import { usePropertyPatch } from './use-property-patch.js';

vi.mock('../../lib/block-fragment-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../lib/block-fragment-api-client.js')
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
    const patchBlock = vi.fn();
    const { result } = renderHook(() =>
      usePropertyPatch({
        pageId: 'page-1',
        token: 'tok',
        onSaveDraft,
        patchBlock,
        debounceMs,
      }),
    );
    return { result, onSaveDraft, patchBlock };
  }

  it('does nothing before the debounce window elapses', () => {
    const { result, onSaveDraft } = setup();

    act(() => {
      result.current.scheduleChange('hero-1', 'Hero', { title: 'New' });
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
      result.current.scheduleChange('hero-1', 'Hero', { title: 'New' });
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    // Deja passare la microtask della Promise risolta dentro il timer.
    await act(async () => {
      await Promise.resolve();
    });

    expect(onSaveDraft).toHaveBeenCalledWith('hero-1', { title: 'New' });
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
      result.current.scheduleChange('hero-1', 'Hero', { title: 'A' });
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.scheduleChange('hero-1', 'Hero', { title: 'AB' });
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Il primo timer è stato cancellato dal secondo cambio — solo 400ms
    // totali sono passati dal SECONDO cambio (200ms), non ancora i 300ms.
    expect(onSaveDraft).not.toHaveBeenCalled();
  });

  it('tracks each block id with its own independent timer', () => {
    const { result, onSaveDraft } = setup();

    act(() => {
      result.current.scheduleChange('hero-1', 'Hero', { title: 'A' });
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    act(() => {
      result.current.scheduleChange('text-1', 'Text', { body: 'B' });
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // hero-1's own 300ms have elapsed (150 + 150); text-1's own 150ms have not.
    expect(onSaveDraft).toHaveBeenCalledWith('hero-1', { title: 'A' });
    expect(onSaveDraft).not.toHaveBeenCalledWith('text-1', { body: 'B' });
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

    expect(onSaveDraft).toHaveBeenCalledWith('hero-1', {
      title: 'Nuovo titolo',
    });
    expect(blockFragmentApi.renderBlockFragment).not.toHaveBeenCalled();
    expect(patchBlock).not.toHaveBeenCalled();
  });

  it('scheduleChange and scheduleTextChange on the same block have independent timers', () => {
    const { result, onSaveDraft } = setup();

    act(() => {
      result.current.scheduleChange('hero-1', 'Hero', { title: 'Prop change' });
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
    expect(onSaveDraft).toHaveBeenCalledWith('hero-1', {
      title: 'Prop change',
    });
    expect(onSaveDraft).not.toHaveBeenCalledWith('hero-1', {
      subtitle: 'Text change',
    });
  });

  it('still saves the draft even when renderBlockFragment rejects', async () => {
    vi.mocked(blockFragmentApi.renderBlockFragment).mockRejectedValue(
      new Error('boom'),
    );
    const { result, onSaveDraft, patchBlock } = setup();

    act(() => {
      result.current.scheduleChange('hero-1', 'Hero', { title: 'New' });
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(onSaveDraft).toHaveBeenCalledWith('hero-1', { title: 'New' });
    expect(patchBlock).not.toHaveBeenCalled();
  });
});
