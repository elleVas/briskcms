import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  PREVIEW_BRIDGE_SOURCE,
  PREVIEW_BRIDGE_VERSION,
} from '@brisk/shared-types';
import { usePreviewBridge } from './use-preview-bridge.js';

const EXPECTED_ORIGIN = 'http://localhost:4321';

function buildIframeRef() {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const ref = createRef<HTMLIFrameElement>();
  ref.current = iframe;
  return { ref, contentWindow: iframe.contentWindow };
}

function dispatchBridgeMessage(
  contentWindow: Window | null,
  origin: string,
  data: unknown,
) {
  const event = new MessageEvent('message', { data, origin });
  // `source` is a getter-only property on the constructed event, and this
  // test environment doesn't honor `MessageEventInit.source` either — a
  // real cross-window postMessage sets it natively, so it's forced here to
  // simulate that.
  Object.defineProperty(event, 'source', { value: contentWindow });
  window.dispatchEvent(event);
}

describe('usePreviewBridge', () => {
  it('starts idle before any message arrives', () => {
    const { ref } = buildIframeRef();
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));

    expect(result.current).toEqual({
      blockRects: [],
      isReady: false,
      hoveredBlockId: null,
      selectedBlockId: null,
      lastDblClick: null,
      lastTextChange: null,
      activeDrag: null,
      dragEnded: null,
      patchBlock: expect.any(Function),
      enterTextEdit: expect.any(Function),
      exitTextEdit: expect.any(Function),
    });
  });

  it('becomes ready and stores blockRects on preview:ready', () => {
    const { ref, contentWindow } = buildIframeRef();
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));

    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:ready',
        payload: {
          blockRects: [{ id: 'a', top: 1, left: 2, width: 3, height: 4 }],
          scrollHeight: 900,
        },
      });
    });

    expect(result.current.isReady).toBe(true);
    expect(result.current.blockRects).toEqual([
      { id: 'a', top: 1, left: 2, width: 3, height: 4 },
    ]);
  });

  it('updates blockRects on preview:block-rects without resetting isReady', () => {
    const { ref, contentWindow } = buildIframeRef();
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));
    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:ready',
        payload: { blockRects: [], scrollHeight: 0 },
      });
    });

    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:block-rects',
        payload: {
          blockRects: [{ id: 'b', top: 5, left: 6, width: 7, height: 8 }],
        },
      });
    });

    expect(result.current.isReady).toBe(true);
    expect(result.current.blockRects).toEqual([
      { id: 'b', top: 5, left: 6, width: 7, height: 8 },
    ]);
  });

  it('tracks the hovered block id, including clearing it back to null', () => {
    const { ref, contentWindow } = buildIframeRef();
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));

    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:hover',
        payload: { blockId: 'hero-1', pointer: { x: 10, y: 20 } },
      });
    });
    expect(result.current.hoveredBlockId).toBe('hero-1');

    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:hover',
        payload: { blockId: null, pointer: { x: 0, y: 0 } },
      });
    });
    expect(result.current.hoveredBlockId).toBeNull();
  });

  it('tracks the selected block id on preview:click', () => {
    const { ref, contentWindow } = buildIframeRef();
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));

    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:click',
        payload: { blockId: 'hero-1' },
      });
    });

    expect(result.current.selectedBlockId).toBe('hero-1');
  });

  it('ignores a message from the wrong origin', () => {
    const { ref, contentWindow } = buildIframeRef();
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));

    act(() => {
      dispatchBridgeMessage(contentWindow, 'http://evil.example', {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:hover',
        payload: { blockId: 'hero-1', pointer: { x: 0, y: 0 } },
      });
    });

    expect(result.current.hoveredBlockId).toBeNull();
  });

  it("ignores a message whose source is not this iframe's own contentWindow", () => {
    const { ref } = buildIframeRef();
    const someOtherWindow = window;
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));

    act(() => {
      dispatchBridgeMessage(someOtherWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:hover',
        payload: { blockId: 'hero-1', pointer: { x: 0, y: 0 } },
      });
    });

    expect(result.current.hoveredBlockId).toBeNull();
  });

  it('ignores a postMessage without the expected envelope (a third-party widget)', () => {
    const { ref, contentWindow } = buildIframeRef();
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));

    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        someUnrelatedPayload: true,
      });
    });

    expect(result.current).toEqual({
      blockRects: [],
      isReady: false,
      hoveredBlockId: null,
      selectedBlockId: null,
      lastDblClick: null,
      lastTextChange: null,
      activeDrag: null,
      dragEnded: null,
      patchBlock: expect.any(Function),
      enterTextEdit: expect.any(Function),
      exitTextEdit: expect.any(Function),
    });
  });

  it('stores the last dblclick as state, as a new object each time', () => {
    const { ref, contentWindow } = buildIframeRef();
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));

    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:dblclick',
        payload: { blockId: 'hero-1', field: 'title' },
      });
    });
    const first = result.current.lastDblClick;
    expect(first).toEqual({ blockId: 'hero-1', field: 'title' });

    // Stesso blockId/field di prima — un `useEffect` del chiamante keyed su
    // `lastDblClick` deve comunque attivarsi di nuovo (per riferimento, non
    // per uguaglianza di contenuto): ogni doppio click è un evento distinto.
    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:dblclick',
        payload: { blockId: 'hero-1', field: 'title' },
      });
    });
    expect(result.current.lastDblClick).toEqual({
      blockId: 'hero-1',
      field: 'title',
    });
    expect(result.current.lastDblClick).not.toBe(first);
  });

  it('stores field: null when the dblclick landed outside any inlineEditable field', () => {
    const { ref, contentWindow } = buildIframeRef();
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));

    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:dblclick',
        payload: { blockId: 'hero-1', field: null },
      });
    });

    expect(result.current.lastDblClick).toEqual({
      blockId: 'hero-1',
      field: null,
    });
  });

  it('stores the last text change as state, as a new object each time', () => {
    const { ref, contentWindow } = buildIframeRef();
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));

    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:text-changed',
        payload: { blockId: 'hero-1', field: 'title', text: 'Nuovo titolo' },
      });
    });
    const first = result.current.lastTextChange;
    expect(first).toEqual({
      blockId: 'hero-1',
      field: 'title',
      text: 'Nuovo titolo',
    });

    // Stesso testo di prima (es. l'utente digita e poi cancella un
    // carattere) — un `useEffect` del chiamante keyed su `lastTextChange`
    // deve comunque attivarsi di nuovo, per riferimento non per contenuto.
    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:text-changed',
        payload: { blockId: 'hero-1', field: 'title', text: 'Nuovo titolo' },
      });
    });
    expect(result.current.lastTextChange).toEqual({
      blockId: 'hero-1',
      field: 'title',
      text: 'Nuovo titolo',
    });
    expect(result.current.lastTextChange).not.toBe(first);
  });

  it('enterTextEdit posts editor:enter-text-edit to the iframe, at the expected origin', () => {
    const { ref, contentWindow } = buildIframeRef();
    if (!contentWindow) {
      throw new Error('Test fixture iframe has no contentWindow');
    }
    const postMessageSpy = vi.spyOn(contentWindow, 'postMessage');
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));

    result.current.enterTextEdit('hero-1', 'title');

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'editor:enter-text-edit',
        payload: { blockId: 'hero-1', field: 'title' },
      },
      EXPECTED_ORIGIN,
    );
  });

  it('exitTextEdit posts editor:exit-text-edit to the iframe, at the expected origin', () => {
    const { ref, contentWindow } = buildIframeRef();
    if (!contentWindow) {
      throw new Error('Test fixture iframe has no contentWindow');
    }
    const postMessageSpy = vi.spyOn(contentWindow, 'postMessage');
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));

    result.current.exitTextEdit();

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'editor:exit-text-edit',
        payload: {},
      },
      EXPECTED_ORIGIN,
    );
  });

  it('patchBlock posts editor:patch-block to the iframe, at the expected origin', () => {
    const { ref, contentWindow } = buildIframeRef();
    if (!contentWindow) {
      throw new Error('Test fixture iframe has no contentWindow');
    }
    const postMessageSpy = vi.spyOn(contentWindow, 'postMessage');
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));

    result.current.patchBlock('hero-1', '<div>new</div>');

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'editor:patch-block',
        payload: { blockId: 'hero-1', html: '<div>new</div>' },
      },
      EXPECTED_ORIGIN,
    );
  });

  it('tracks activeDrag on preview:drag-start and updates its pointer on preview:drag-move', () => {
    const { ref, contentWindow } = buildIframeRef();
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));

    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:drag-start',
        payload: { blockId: 'hero-1', pointer: { x: 10, y: 20 } },
      });
    });
    expect(result.current.activeDrag).toEqual({
      blockId: 'hero-1',
      pointer: { x: 10, y: 20 },
    });

    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:drag-move',
        payload: { pointer: { x: 15, y: 40 } },
      });
    });
    expect(result.current.activeDrag).toEqual({
      blockId: 'hero-1',
      pointer: { x: 15, y: 40 },
    });
  });

  it('ignores preview:drag-move when no drag is active', () => {
    const { ref, contentWindow } = buildIframeRef();
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));

    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:drag-move',
        payload: { pointer: { x: 15, y: 40 } },
      });
    });

    expect(result.current.activeDrag).toBeNull();
  });

  it('clears activeDrag and reports dragEnded on preview:drag-end', () => {
    const { ref, contentWindow } = buildIframeRef();
    const { result } = renderHook(() => usePreviewBridge(ref, EXPECTED_ORIGIN));

    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:drag-start',
        payload: { blockId: 'hero-1', pointer: { x: 10, y: 20 } },
      });
    });
    act(() => {
      dispatchBridgeMessage(contentWindow, EXPECTED_ORIGIN, {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'preview:drag-end',
        payload: {},
      });
    });

    expect(result.current.activeDrag).toBeNull();
    expect(result.current.dragEnded).toEqual({
      blockId: 'hero-1',
      pointer: { x: 10, y: 20 },
    });
  });
});
