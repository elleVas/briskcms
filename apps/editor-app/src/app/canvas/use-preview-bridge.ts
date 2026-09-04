import { useCallback, useEffect, useState, type RefObject } from 'react';
import {
  isPreviewBridgeMessage,
  PREVIEW_BRIDGE_SOURCE,
  PREVIEW_BRIDGE_VERSION,
  type BlockRect,
} from '@brisk/shared-types';

export interface PreviewBridgeState {
  /** Empty until `preview:ready` arrives for the first time. */
  blockRects: BlockRect[];
  isReady: boolean;
  hoveredBlockId: string | null;
  /**
   * No longer read-only: besides a real `preview:click` from the iframe,
   * `selectBlock` below also writes it directly — the Layers panel needs
   * that to select a block the canvas covers completely with one of its own
   * children (a Column containing a single full-width Gallery, say: no
   * canvas pixel belongs to the Column itself any more), where clicking on
   * the canvas would always select the child and never the parent.
   */
  selectedBlockId: string | null;
  /**
   * The last double click received (Day 4) — a NEW OBJECT on every message
   * (even when blockId/field are identical to the previous one), so a
   * caller's `useEffect` keyed on this value fires on every single double
   * click by reference, not by content equality. Exposed as state rather
   * than as a callback: deciding whether the field is `inlineEditable`
   * requires the block-registry, which this hook (a generic postMessage
   * bridge) knows nothing about — that policy lives in the caller
   * (canvas-editor-shell.tsx), not here.
   */
  lastDblClick: { blockId: string; field: string | null } | null;
  /**
   * The last text typed live in a TipTap instance mounted in place (Day 4)
   * — the same reason as `lastDblClick`: a new object on every message, so
   * a caller's `useEffect` fires on every single change even when
   * blockId/field repeat.
   */
  lastTextChange: { blockId: string; field: string; text: string } | null;
  /**
   * Non-null while a simulated drag is in progress (direct canvas
   * reordering, Day 3/4) — `pointer` is iframe-relative (the same semantics
   * as `BlockRect`; the caller combines it with the iframe's offset to draw
   * the drop indicator, as OverlayLayer already does for hover/selection).
   */
  activeDrag: { blockId: string; pointer: { x: number; y: number } } | null;
  /**
   * A new object on every `preview:drag-end` (the same reason as
   * `lastDblClick`) — it carries the last known blockId/pointer of the drag
   * that just ended, so the caller can compute the final drop position and
   * apply it to its own `Block[]`. `activeDrag` returns to `null` in the
   * same state update (the drag is visually over).
   */
  dragEnded: { blockId: string; pointer: { x: number; y: number } } | null;
  /** Sostituisce un blocco già renderizzato con l'HTML del frammento ottenuto da render-block-fragment (Giorno 3) — vedi block-fragment-api-client.ts. */
  patchBlock: (blockId: string, html: string) => void;
  /** Inserts a block NEVER rendered before (insert/duplicate) — see EditorInsertBlockMessage. */
  insertBlock: (
    html: string,
    parentId: string | null,
    beforeBlockId: string | null,
  ) => void;
  /** Removes an already-rendered block from the iframe's DOM — see EditorRemoveBlockMessage. */
  removeBlock: (blockId: string) => void;
  /** Reorders the existing siblings (all already rendered) — see EditorReorderBlocksMessage. */
  reorderBlocks: (parentId: string | null, orderedIds: string[]) => void;
  /** Monta TipTap sul posto nell'iframe (Giorno 4) — vedi editor:enter-text-edit. */
  enterTextEdit: (blockId: string, field: string) => void;
  /** Smonta l'istanza TipTap corrente nell'iframe, se c'è. */
  exitTextEdit: () => void;
  /** Selects a block directly from this side (the Layers panel), without going through a real `preview:click` on the canvas — see the comment on `selectedBlockId` above. */
  selectBlock: (blockId: string | null) => void;
  /** Updates the `<style>` holding the "component-level" overrides in the iframe (docs/adr/0022, the "Style" button) — `css` is already prepared (buildBlockStyleOverridesCss), and the iframe only writes it. */
  updateBlockStyleCss: (css: string) => void;
  /** Brings block `blockId` into view in the iframe's document (the Layers panel) — see EditorScrollToBlockMessage. */
  scrollToBlock: (blockId: string) => void;
}

type PreviewBridgeMessageState = Omit<
  PreviewBridgeState,
  | 'patchBlock'
  | 'insertBlock'
  | 'removeBlock'
  | 'reorderBlocks'
  | 'enterTextEdit'
  | 'exitTextEdit'
  | 'selectBlock'
  | 'updateBlockStyleCss'
  | 'scrollToBlock'
>;

const initialState: PreviewBridgeMessageState = {
  blockRects: [],
  isReady: false,
  hoveredBlockId: null,
  selectedBlockId: null,
  lastDblClick: null,
  lastTextChange: null,
  activeDrag: null,
  dragEnded: null,
};

/**
 * The parent side of the postMessage protocol (see
 * @brisk/shared-types/preview-bridge-protocol.ts and the visual editor
 * plan, Day 2) — it listens for `preview:*` from one specific iframe, never
 * from just any iframe: both `event.origin` and `event.source` are checked,
 * so another iframe or extension sending the same envelope would never be
 * considered.
 *
 * Every incoming event is exposed as STATE (never as a callback prop): a
 * callback passed by the caller would have a fresh identity on each of its
 * renders, and making it depend on other values derived from the caller's
 * own hooks (`usePropertyPatch`, say, which in turn needs `patchBlock`
 * returned by THIS hook) would create a cycle between two hook calls —
 * nothing of the sort happens with state: the caller reacts with its own
 * `useEffect` keyed on the value, read when it needs it.
 */
export function usePreviewBridge(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  expectedOrigin: string,
): PreviewBridgeState {
  const [state, setState] = useState<PreviewBridgeMessageState>(initialState);

  useEffect(() => {
    function handleMessage(event: MessageEvent): void {
      // The iframe is sandboxed without `allow-same-origin` (it holds
      // blocks inserted by platform users, which are not trusted) — its
      // origin is therefore opaque, and every message leaving it arrives
      // with `event.origin === 'null'`, never public-site's real origin.
      // The check's security still holds through the identity comparison
      // below (`event.source`), which pins down that exact iframe
      // regardless of the origin string.
      if (event.origin !== expectedOrigin && event.origin !== 'null') {
        return;
      }
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (!isPreviewBridgeMessage(event.data)) {
        return;
      }

      const message = event.data;
      switch (message.type) {
        case 'preview:ready':
          setState((prev) => ({
            ...prev,
            isReady: true,
            blockRects: message.payload.blockRects,
          }));
          return;
        case 'preview:block-rects':
          setState((prev) => ({
            ...prev,
            blockRects: message.payload.blockRects,
          }));
          return;
        case 'preview:hover':
          setState((prev) => ({
            ...prev,
            hoveredBlockId: message.payload.blockId,
          }));
          return;
        case 'preview:click':
          setState((prev) => ({
            ...prev,
            selectedBlockId: message.payload.blockId,
          }));
          return;
        case 'preview:dblclick':
          setState((prev) => ({
            ...prev,
            lastDblClick: {
              blockId: message.payload.blockId,
              field: message.payload.field,
            },
          }));
          return;
        case 'preview:text-changed':
          setState((prev) => ({
            ...prev,
            lastTextChange: {
              blockId: message.payload.blockId,
              field: message.payload.field,
              text: message.payload.text,
            },
          }));
          return;
        case 'preview:drag-start':
          setState((prev) => ({
            ...prev,
            activeDrag: {
              blockId: message.payload.blockId,
              pointer: message.payload.pointer,
            },
          }));
          return;
        case 'preview:drag-move':
          setState((prev) =>
            prev.activeDrag
              ? {
                  ...prev,
                  activeDrag: {
                    ...prev.activeDrag,
                    pointer: message.payload.pointer,
                  },
                }
              : prev,
          );
          return;
        case 'preview:drag-end':
          setState((prev) => ({
            ...prev,
            activeDrag: null,
            dragEnded: prev.activeDrag,
          }));
          return;
        case 'editor:patch-block':
        case 'editor:enter-text-edit':
        case 'editor:exit-text-edit':
        case 'editor:insert-block':
        case 'editor:remove-block':
        case 'editor:reorder-blocks':
        case 'editor:update-block-style-css':
        case 'editor:scroll-to-block':
          // Genitore -> iframe: mai attesi in arrivo qui, il genitore è chi
          // li invia (vedi patchBlock/enterTextEdit/exitTextEdit sotto).
          // Ignorati difensivamente.
          return;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [iframeRef, expectedOrigin]);

  const patchBlock = useCallback(
    (blockId: string, html: string) => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: PREVIEW_BRIDGE_SOURCE,
          v: PREVIEW_BRIDGE_VERSION,
          type: 'editor:patch-block',
          payload: { blockId, html },
        },
        // Not `expectedOrigin`: the iframe is sandboxed without
        // `allow-same-origin` (see handleMessage above), so its origin is
        // opaque and can never match a literal string — `'*'` has to be
        // used. No security is lost: the write goes to the direct
        // `iframeRef.current.contentWindow` reference, never to a window
        // that was "found".
        '*',
      );
    },
    [iframeRef],
  );

  const insertBlock = useCallback(
    (html: string, parentId: string | null, beforeBlockId: string | null) => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: PREVIEW_BRIDGE_SOURCE,
          v: PREVIEW_BRIDGE_VERSION,
          type: 'editor:insert-block',
          payload: { html, parentId, beforeBlockId },
        },
        '*',
      );
    },
    [iframeRef],
  );

  const removeBlock = useCallback(
    (blockId: string) => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: PREVIEW_BRIDGE_SOURCE,
          v: PREVIEW_BRIDGE_VERSION,
          type: 'editor:remove-block',
          payload: { blockId },
        },
        '*',
      );
    },
    [iframeRef],
  );

  const reorderBlocks = useCallback(
    (parentId: string | null, orderedIds: string[]) => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: PREVIEW_BRIDGE_SOURCE,
          v: PREVIEW_BRIDGE_VERSION,
          type: 'editor:reorder-blocks',
          payload: { parentId, orderedIds },
        },
        '*',
      );
    },
    [iframeRef],
  );

  const enterTextEdit = useCallback(
    (blockId: string, field: string) => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: PREVIEW_BRIDGE_SOURCE,
          v: PREVIEW_BRIDGE_VERSION,
          type: 'editor:enter-text-edit',
          payload: { blockId, field },
        },
        '*',
      );
    },
    [iframeRef],
  );

  const exitTextEdit = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: PREVIEW_BRIDGE_SOURCE,
        v: PREVIEW_BRIDGE_VERSION,
        type: 'editor:exit-text-edit',
        payload: {},
      },
      '*',
    );
  }, [iframeRef]);

  const selectBlock = useCallback((blockId: string | null) => {
    setState((prev) => ({ ...prev, selectedBlockId: blockId }));
  }, []);

  const updateBlockStyleCss = useCallback(
    (css: string) => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: PREVIEW_BRIDGE_SOURCE,
          v: PREVIEW_BRIDGE_VERSION,
          type: 'editor:update-block-style-css',
          payload: { css },
        },
        '*',
      );
    },
    [iframeRef],
  );

  const scrollToBlock = useCallback(
    (blockId: string) => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          source: PREVIEW_BRIDGE_SOURCE,
          v: PREVIEW_BRIDGE_VERSION,
          type: 'editor:scroll-to-block',
          payload: { blockId },
        },
        '*',
      );
    },
    [iframeRef],
  );

  return {
    ...state,
    patchBlock,
    insertBlock,
    removeBlock,
    reorderBlocks,
    enterTextEdit,
    exitTextEdit,
    selectBlock,
    updateBlockStyleCss,
    scrollToBlock,
  };
}
