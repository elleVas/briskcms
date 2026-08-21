import { useCallback, useState } from 'react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { Block } from '@brisk/shared-types';
import {
  publishSiteLayoutSection,
  saveDraft,
  updateSticky,
  type SiteLayoutSectionKind,
} from '../lib/site-layout-sections-api-client.js';
import { siteLayoutSectionQueryOptions } from './site-layout-sections-queries.js';
import type { SaveStatus } from './use-page-editor.js';

// No debounce here (unlike the old Puck-backed version) — same reasoning
// as usePageEditor.ts: canvas-editor-shell.tsx already debounces
// property/text changes on its own.
export function useSiteLayoutSectionEditor(
  siteId: string,
  locale: string,
  kind: SiteLayoutSectionKind,
) {
  const queryOptions = siteLayoutSectionQueryOptions(siteId, locale, kind);
  const { data: section } = useSuspenseQuery(queryOptions);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

  const saveDraftMutation = useMutation({
    mutationFn: (content: Block[]) => saveDraft(section.id, content),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryOptions.queryKey, updated);
      setStatus({ kind: 'saved' });
    },
    onError: (error: unknown) =>
      setStatus({ kind: 'error', message: String(error) }),
  });

  const publishMutation = useMutation({
    mutationFn: async (content: Block[]) => {
      await saveDraft(section.id, content);
      return publishSiteLayoutSection(section.id);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryOptions.queryKey, updated);
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

  // Not part of saveDraftMutation on purpose (docs/adr/0018 follow-up):
  // sticky takes effect immediately, it isn't "content" the canvas debounces
  // alongside its own property/text changes.
  const stickyMutation = useMutation({
    mutationFn: (sticky: boolean) => updateSticky(section.id, sticky),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryOptions.queryKey, updated);
    },
    onError: (error: unknown) =>
      setStatus({ kind: 'error', message: String(error) }),
  });

  const handleStickyChange = useCallback(
    (sticky: boolean) => stickyMutation.mutate(sticky),
    [stickyMutation],
  );

  return {
    section,
    status,
    handleChange,
    handlePublish,
    handleStickyChange,
  };
}
