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
 *
 * It also answers WHEN the queue is empty. The canvas needs that: where it
 * cannot patch a block in place it reloads the iframe, and the iframe reads
 * the saved draft back — so reloading while a save was still in flight
 * showed the page as it was one change ago.
 */
export function useSingleFlightSave<T>(
  save: (value: T) => Promise<unknown>,
): [schedule: (value: T) => void, whenSettled: () => Promise<void>] {
  const isSavingRef = useRef(false);
  const pendingRef = useRef<T | null>(null);
  /** The run currently draining the queue, `null` when there is nothing to wait for. */
  const runningRef = useRef<Promise<void> | null>(null);

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

  const schedule = useCallback(
    (value: T) => {
      pendingRef.current = value;
      if (!runningRef.current) {
        runningRef.current = flush().finally(() => {
          runningRef.current = null;
        });
      }
    },
    [flush],
  );

  // Whatever is in flight NOW, including anything scheduled while it runs:
  // the loop inside `flush` picks those up in the same pass, so one promise
  // covers the whole drain.
  const whenSettled = useCallback(
    () => runningRef.current ?? Promise.resolve(),
    [],
  );

  return [schedule, whenSettled];
}
