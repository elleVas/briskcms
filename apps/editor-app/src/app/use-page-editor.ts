import { useCallback, useState } from 'react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { Block } from '@brisk/shared-types';
import { publishPage, saveDraft } from '../lib/pages-api-client.js';
import { pageQueryOptions } from './pages-queries.js';

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saved' }
  | { kind: 'published' }
  | { kind: 'error'; message: string };

// Reads through the same query the route loader already warmed (see
// routes/pages.$pageId.tsx) — no extra request, but this hook is now also
// reactively subscribed: a mutation elsewhere that invalidates this page
// (e.g. a rollback) re-renders it with fresh data automatically.
//
// No debounce here (unlike the old Puck-backed version) — canvas-editor-
// shell.tsx already debounces property/text changes on its own (see
// use-property-patch.ts's ~300ms window); insert/remove/reorder call
// `onChange` directly because those should feel instant, not delayed by a
// second debounce layered on top.
export function usePageEditor(pageId: string) {
  const { data: page } = useSuspenseQuery(pageQueryOptions(pageId));
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

  const saveDraftMutation = useMutation({
    mutationFn: (content: Block[]) => saveDraft(pageId, content),
    onSuccess: (updated) => {
      queryClient.setQueryData(pageQueryOptions(pageId).queryKey, updated);
      setStatus({ kind: 'saved' });
    },
    onError: (error: unknown) =>
      setStatus({ kind: 'error', message: String(error) }),
  });

  const publishMutation = useMutation({
    mutationFn: async (content: Block[]) => {
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
    (content: Block[]) => {
      saveDraftMutation.mutate(content);
    },
    [saveDraftMutation],
  );

  const handlePublish = useCallback(
    (content: Block[]) => publishMutation.mutateAsync(content),
    [publishMutation],
  );

  return { page, status, handleChange, handlePublish };
}
