import { useCallback } from 'react';
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
} from '../lib/site-layout-sections-api-client';
import { siteLayoutSectionQueryOptions } from './site-layout-sections-queries';
import { useDraftEditor } from './use-draft-editor';

// No debounce here — same reasoning as usePageGroupEditor:
// canvas-editor-shell.tsx already debounces property/text changes on its
// own. The draft/publish lifecycle itself lives in useDraftEditor.
export function useSiteLayoutSectionEditor(
  siteId: string,
  locale: string,
  kind: SiteLayoutSectionKind,
) {
  const queryOptions = siteLayoutSectionQueryOptions(siteId, locale, kind);
  const { data: section } = useSuspenseQuery(queryOptions);
  const queryClient = useQueryClient();

  const draft = useDraftEditor({
    queryKey: queryOptions.queryKey,
    save: useCallback(
      (content: Block[]) => saveDraft(section.id, content),
      [section.id],
    ),
    publish: useCallback(
      () => publishSiteLayoutSection(section.id),
      [section.id],
    ),
  });
  const { setStatus } = draft;

  // Not part of the draft on purpose (docs/adr/0018 follow-up): sticky
  // takes effect immediately, it isn't "content" the canvas debounces
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
    status: draft.status,
    isSaving: draft.isSaving,
    handleChange: draft.handleChange,
    handlePublish: draft.handlePublish,
    whenSaved: draft.whenSaved,
    handleStickyChange,
  };
}
