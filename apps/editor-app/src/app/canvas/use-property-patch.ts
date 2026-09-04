import { useCallback, useEffect, useRef } from 'react';
import type { Block, BlockStyleOverride } from '@brisk/shared-types';
import { renderBlockFragment } from '../../lib/block-fragment-api-client';

export interface UsePropertyPatchInput {
  pageId: string;
  token: string;
  /**
   * Called with the props already merged (the caller owns the tree, see
   * use-block-tree.ts) — it persists the real draft. `changedKey` is the
   * SINGLE key this call is actually changing (`props` stays the whole
   * merged object, still needed for the server-side fragment render) — it
   * lets the caller (canvas-editor-shell.tsx, field-level i18n) route ONLY
   * that key to a translation's overlay when it needs to, without having to
   * narrow `props` itself.
   */
  onSaveDraft: (
    blockId: string,
    changedKey: string,
    props: Record<string, unknown>,
  ) => void;
  /** Like `onSaveDraft` but for the per-instance override (docs/adr/0022) — a value separate from `props`, replaced wholesale (see use-block-tree.ts's updateBlockStyleOverride) rather than merged field by field. */
  onSaveStyleOverride: (
    blockId: string,
    styleOverride: BlockStyleOverride,
  ) => void;
  /** Da usePreviewBridge — invia editor:patch-block all'iframe. */
  patchBlock: (blockId: string, html: string) => void;
  debounceMs?: number;
}

export interface UsePropertyPatchResult {
  /** To be called on every property change from the Inspector — one blockId at a time has its own independent timer, so changing one block never resets another's debounce. */
  scheduleChange: (
    blockId: string,
    blockType: string,
    changedKey: string,
    props: Record<string, unknown>,
    children?: Block[],
  ) => void;
  /**
   * To be called on every `preview:text-changed` (Day 4) — the same
   * per-blockId debounce as `scheduleChange`, but saving only: never
   * render-block-fragment/patchBlock for text, since the DOM inside the
   * iframe already shows what TipTap has typed live, and replacing it with
   * a freshly rendered fragment would tear down the TipTap instance mounted
   * on it mid-keystroke.
   */
  scheduleTextChange: (blockId: string, field: string, text: string) => void;
  /** To be called on every change in the per-instance style popover (docs/adr/0022) — a timer independent of `scheduleChange`'s: a style change and an ordinary property change on the same block, close together, do not cancel each other's debounce. */
  scheduleStyleOverrideChange: (
    blockId: string,
    blockType: string,
    props: Record<string, unknown>,
    styleOverride: BlockStyleOverride,
    children?: Block[],
  ) => void;
  /**
   * Fires every still-pending debounced save right now, instead of waiting
   * out its timer — called before Publish (canvas-editor-shell.tsx's own
   * handlePublish) so the last keystroke within the debounce window is
   * never silently dropped from what gets published. Safe to call with
   * nothing pending (no-op).
   */
  flushAll: () => void;
}

const DEFAULT_DEBOUNCE_MS = 300;

/**
 * On a property change: it saves the draft (debounced, the same
 * `PATCH /pages/:id/draft` as use-page-editor.ts) and in parallel calls
 * render-block-fragment with the new props, then sends `editor:patch-block`
 * — the canvas updates without an iframe reload. See the visual editor
 * plan, Day 3. A renderBlockFragment failure does not block the save (which
 * already happened): the canvas keeps the last good HTML until the next
 * change retries.
 */
export function usePropertyPatch({
  pageId,
  token,
  onSaveDraft,
  onSaveStyleOverride,
  patchBlock,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UsePropertyPatchInput): UsePropertyPatchResult {
  const timers = useRef(
    new Map<
      string,
      { timeout: ReturnType<typeof setTimeout>; fire: () => void }
    >(),
  );

  useEffect(() => {
    const timersAtMount = timers.current;
    return () => {
      for (const { timeout } of timersAtMount.values()) {
        clearTimeout(timeout);
      }
      timersAtMount.clear();
    };
  }, []);

  // A debounce key distinct from a plain blockId (see scheduleTextChange
  // below) — a non-text property change and text being edited on the same
  // block have independent timers, and neither resets the other's debounce.
  // `fire` is kept alongside the timeout (not just the latter) so flushAll
  // below can invoke it immediately rather than waiting for it to expire.
  function schedule(timerKey: string, fire: () => void): void {
    const existing = timers.current.get(timerKey);
    if (existing) {
      clearTimeout(existing.timeout);
    }
    const timeout = setTimeout(() => {
      timers.current.delete(timerKey);
      fire();
    }, debounceMs);
    timers.current.set(timerKey, { timeout, fire });
  }

  const flushAll = useCallback(() => {
    const pending = [...timers.current.values()];
    timers.current.clear();
    for (const { timeout, fire } of pending) {
      clearTimeout(timeout);
      fire();
    }
  }, []);

  const scheduleChange = useCallback(
    (
      blockId: string,
      blockType: string,
      changedKey: string,
      props: Record<string, unknown>,
      children?: Block[],
    ) => {
      schedule(blockId, () => {
        onSaveDraft(blockId, changedKey, props);
        renderBlockFragment({
          pageId,
          token,
          blockId,
          blockType,
          props,
          children,
        })
          .then((html) => patchBlock(blockId, html))
          .catch(() => {
            /* the draft is already saved above — a failure here only leaves the canvas one change behind visually, it loses no data. */
          });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `schedule` is redefined on every render but reads only `timers` (a ref, stable) and `debounceMs` (already an explicit dependency) — including it would break scheduleChange's stable identity for no benefit.
    [pageId, token, onSaveDraft, patchBlock, debounceMs],
  );

  const scheduleTextChange = useCallback(
    (blockId: string, field: string, text: string) => {
      schedule(`text:${blockId}`, () => {
        onSaveDraft(blockId, field, { [field]: text });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vedi scheduleChange sopra.
    [onSaveDraft, debounceMs],
  );

  const scheduleStyleOverrideChange = useCallback(
    (
      blockId: string,
      blockType: string,
      props: Record<string, unknown>,
      styleOverride: BlockStyleOverride,
      children?: Block[],
    ) => {
      schedule(`style:${blockId}`, () => {
        onSaveStyleOverride(blockId, styleOverride);
        renderBlockFragment({
          pageId,
          token,
          blockId,
          blockType,
          props,
          children,
          styleOverride,
        })
          .then((html) => patchBlock(blockId, html))
          .catch(() => {
            /* the draft is already saved above — see the same comment on scheduleChange. */
          });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vedi scheduleChange sopra.
    [pageId, token, onSaveStyleOverride, patchBlock, debounceMs],
  );

  return {
    scheduleChange,
    scheduleTextChange,
    scheduleStyleOverrideChange,
    flushAll,
  };
}
