import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { Data } from '@puckeditor/core';
import { headerFooterPuckConfig } from '@brisk/puck-config';
import {
  publishSiteLayoutSection,
  saveDraft,
  updateSticky,
  type SiteLayoutSectionKind,
} from '../lib/site-layout-sections-api-client.js';
import { fromPuckData } from '../lib/puck-data-mapper.js';
import { siteLayoutSectionQueryOptions } from './site-layout-sections-queries.js';
import type { SaveStatus } from './use-page-editor.js';

// Same debounce reasoning as usePageEditor: Puck's onChange fires on every
// keystroke, and every draft save creates a
// site_layout_section_versions row.
const DRAFT_SAVE_DEBOUNCE_MS = 1000;

export function useSiteLayoutSectionEditor(
  siteId: string,
  locale: string,
  kind: SiteLayoutSectionKind,
) {
  const queryOptions = siteLayoutSectionQueryOptions(siteId, locale, kind);
  const { data: section } = useSuspenseQuery(queryOptions);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const saveTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(saveTimeoutRef.current), []);

  const saveDraftMutation = useMutation({
    mutationFn: (content: ReturnType<typeof fromPuckData>) =>
      saveDraft(section.id, content),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryOptions.queryKey, updated);
      setStatus({ kind: 'saved' });
    },
    onError: (error: unknown) =>
      setStatus({ kind: 'error', message: String(error) }),
  });

  const publishMutation = useMutation({
    mutationFn: async (content: ReturnType<typeof fromPuckData>) => {
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
    (data: Data) => {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(() => {
        saveDraftMutation.mutate(fromPuckData(data, headerFooterPuckConfig));
      }, DRAFT_SAVE_DEBOUNCE_MS);
    },
    [saveDraftMutation],
  );

  const handlePublish = useCallback(
    (data: Data) => {
      window.clearTimeout(saveTimeoutRef.current);
      return publishMutation.mutateAsync(
        fromPuckData(data, headerFooterPuckConfig),
      );
    },
    [publishMutation],
  );

  // Not part of saveDraftMutation on purpose (docs/adr/0018 follow-up):
  // sticky takes effect immediately, it isn't "content" a debounced
  // autosave should batch with Puck's own onChange.
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
