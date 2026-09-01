import { useCallback, useRef } from 'react';

/**
 * Extracted from use-page-editor.ts's original inline queue — reused by
 * use-page-group-editor.ts for its own two independent save targets
 * (shared structure, per-locale field values). Same discipline: never more
 * than one `save()` in flight at a time, a `schedule()` call while one is
 * already running just overwrites what will be sent next, so an older
 * in-flight request can never complete after a newer one and silently
 * clobber it. Reproduced live: Hero+Image in editor, only Hero survived a
 * reload, without this.
 */
export function useSingleFlightSave<T>(
  save: (value: T) => Promise<unknown>,
): (value: T) => void {
  const isSavingRef = useRef(false);
  const pendingRef = useRef<T | null>(null);

  const flush = useCallback(async () => {
    if (isSavingRef.current) {
      return;
    }
    isSavingRef.current = true;
    try {
      // Loop instead of recursing: a new `schedule()` call that arrives
      // WHILE this `await` is in flight is picked up right away in the
      // same pass, instead of exiting and re-entering the function.
      while (pendingRef.current !== null) {
        const next = pendingRef.current;
        pendingRef.current = null;
        try {
          await save(next);
        } catch {
          // The caller's own mutation onError (if any) already ran — this
          // just needs to not block the queue, so a later schedule() can
          // still retry.
        }
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [save]);

  return useCallback(
    (value: T) => {
      pendingRef.current = value;
      void flush();
    },
    [flush],
  );
}
