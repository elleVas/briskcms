import { useState } from 'react';
import type { FieldValues, UseFormReset } from 'react-hook-form';

/**
 * Re-seeds a react-hook-form form from freshly-fetched data every time a
 * dialog opens — these settings dialogs stay mounted for the app's whole
 * lifetime (rendered from SettingsMenu), only `open` toggles, so without
 * this a previous edit session's values would leak into the next one.
 * `source` arrives asynchronously (its query is gated on `open`), so the
 * sync key also changes the moment it loads, not just when `open` flips.
 *
 * Adjusts state during render (comparing against the last render's sync
 * key) rather than in a `useEffect`, per
 * https://react.dev/learn/you-might-not-need-an-effect — was duplicated
 * as this exact pattern, by hand, in 5 settings dialogs before this hook.
 */
export function useResetFormOnOpen<TSource, TFieldValues extends FieldValues>(
  open: boolean,
  source: TSource | undefined,
  reset: UseFormReset<TFieldValues>,
  toValues: (source: TSource) => TFieldValues,
): void {
  const [lastSyncKey, setLastSyncKey] = useState<string | null>(null);
  const syncKey = open ? `open:${source ? 'ready' : 'loading'}` : 'closed';
  if (syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    if (open && source) {
      reset(toValues(source));
    }
  }
}
