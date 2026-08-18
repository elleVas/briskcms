import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { Data } from '@puckeditor/core';
import { fromPuckData } from '../lib/puck-data-mapper.js';
import { publishPage, saveDraft } from '../lib/pages-api-client.js';
import { pageQueryOptions } from './pages-queries.js';

// Draft autosave is debounced: Puck's onChange fires on every keystroke, and
// every draft save creates a page_versions row (see domain-core Page) — no
// debounce would flood the version history with one row per character typed.
const DRAFT_SAVE_DEBOUNCE_MS = 1000;

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saved' }
  | { kind: 'published' }
  | { kind: 'error'; message: string };

// Reads through the same query the route loader already warmed (see
// routes/pages.$pageId.tsx) — no extra request, but this hook is now also
// reactively subscribed: a mutation elsewhere that invalidates this page
// (e.g. a rollback) re-renders it with fresh data automatically.
export function usePageEditor(pageId: string) {
  const { data: page } = useSuspenseQuery(pageQueryOptions(pageId));
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const saveTimeoutRef = useRef<number | undefined>(undefined);

  // Cancels a pending debounced save on unmount — covers navigating away
  // from the editor (back to the list, or logging out) mid-debounce.
  useEffect(() => () => window.clearTimeout(saveTimeoutRef.current), []);

  const saveDraftMutation = useMutation({
    mutationFn: (content: ReturnType<typeof fromPuckData>) =>
      saveDraft(pageId, content),
    onSuccess: (updated) => {
      queryClient.setQueryData(pageQueryOptions(pageId).queryKey, updated);
      setStatus({ kind: 'saved' });
    },
    onError: (error: unknown) =>
      setStatus({ kind: 'error', message: String(error) }),
  });

  const publishMutation = useMutation({
    mutationFn: async (content: ReturnType<typeof fromPuckData>) => {
      await saveDraft(pageId, content);
      return publishPage(pageId);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(pageQueryOptions(pageId).queryKey, updated);
      // Partial key: invalidates every cached page of list results for
      // this site (see pages-queries.ts), not just one page number.
      queryClient.invalidateQueries({ queryKey: ['pages', updated.siteId] });
      setStatus({ kind: 'published' });
    },
    onError: (error: unknown) =>
      setStatus({ kind: 'error', message: String(error) }),
  });

  const handleChange = useCallback(
    (data: Data) => {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(() => {
        saveDraftMutation.mutate(fromPuckData(data));
      }, DRAFT_SAVE_DEBOUNCE_MS);
    },
    [saveDraftMutation],
  );

  const handlePublish = useCallback(
    (data: Data) => {
      window.clearTimeout(saveTimeoutRef.current);
      return publishMutation.mutateAsync(fromPuckData(data));
    },
    [publishMutation],
  );

  return { page, status, handleChange, handlePublish };
}
