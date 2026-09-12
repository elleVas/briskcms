import { useEffect, useRef } from 'react';

export interface UnsavedChangesGuardParams {
  /** True while a change exists that the server has not acknowledged — a debounce still counting down, or a request still on the wire. */
  hasUnsavedChanges: boolean;
  /**
   * Called before the browser puts the question to the person.
   *
   * It turns "the change is sitting in a timer" into "the change is on the
   * wire", so whoever answers "stay on this page" keeps it without having
   * to touch anything again. There is no way to finish an asynchronous
   * request during an unload, so this is a head start, not a guarantee —
   * the prompt is what actually makes the loss impossible by accident.
   */
  onBeforeUnload?: () => void;
}

/**
 * The guard the editor did not have: closing the tab or reloading it
 * within the save debounce lost the last change without a word.
 *
 * Deliberately only `beforeunload`. Navigating INSIDE the app is handled
 * where it can be handled properly — the canvas flushes its pending saves
 * as it unmounts (see useCanvasDraft), so leaving by the "Pages" link
 * costs nothing and needs no question. A browser leaving the document is
 * the one case nothing can rescue, and the only one worth interrupting
 * somebody for.
 */
export function useUnsavedChangesGuard({
  hasUnsavedChanges,
  onBeforeUnload,
}: UnsavedChangesGuardParams): void {
  // The listener is attached once and reads through this, like the canvas
  // shortcuts do: re-attaching on every keystroke would be the alternative,
  // and a listener that re-registers while a save is pending is one more
  // thing that can be wrong at exactly the wrong moment.
  const stateRef = useRef({ hasUnsavedChanges, onBeforeUnload });
  useEffect(() => {
    stateRef.current = { hasUnsavedChanges, onBeforeUnload };
  });

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent): void {
      const state = stateRef.current;
      if (!state.hasUnsavedChanges) {
        return;
      }
      state.onBeforeUnload?.();
      // Both, deliberately: preventDefault() is what the current standard
      // asks for, and a non-empty returnValue is what older engines still
      // read. Setting only one of them silently does nothing somewhere.
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}
