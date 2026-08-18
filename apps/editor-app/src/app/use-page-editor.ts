import { useCallback, useEffect, useRef, useState } from 'react';
import type { Data } from '@puckeditor/core';
import { fromPuckData } from '../lib/puck-data-mapper.js';
import {
  publishPage,
  saveDraft,
  type PageDto,
} from '../lib/pages-api-client.js';

// Draft autosave is debounced: Puck's onChange fires on every keystroke, and
// every draft save creates a page_versions row (see domain-core Page) — no
// debounce would flood the version history with one row per character typed.
const DRAFT_SAVE_DEBOUNCE_MS = 1000;

// Takes the already-loaded page (the route loader owns fetching it — and
// redirecting to /login on a 401, see routes/pages.$pageId.tsx) — this hook
// only owns editing behavior: autosave and publish.
export function usePageEditor(initialPage: PageDto) {
  const [page] = useState(initialPage);
  const [status, setStatus] = useState('');
  const saveTimeoutRef = useRef<number | undefined>(undefined);

  // Cancels a pending debounced save on unmount — covers navigating away
  // from the editor (back to the list, or logging out) mid-debounce, not
  // just an explicit "Esci" click.
  useEffect(() => () => window.clearTimeout(saveTimeoutRef.current), []);

  const handleChange = useCallback(
    (data: Data) => {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(() => {
        saveDraft(page.id, fromPuckData(data))
          .then(() => setStatus('Bozza salvata'))
          .catch((error: unknown) => setStatus(String(error)));
      }, DRAFT_SAVE_DEBOUNCE_MS);
    },
    [page.id],
  );

  const handlePublish = useCallback(
    async (data: Data) => {
      window.clearTimeout(saveTimeoutRef.current);
      await saveDraft(page.id, fromPuckData(data));
      await publishPage(page.id);
      setStatus('Pubblicato');
    },
    [page.id],
  );

  return { page, status, handleChange, handlePublish };
}
