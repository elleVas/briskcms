import { useCallback, useState } from 'react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { Block, ExposedFields } from '@brisk/shared-types';
import {
  publishReusableSection,
  saveDraft,
  setExposedFields,
} from '../lib/reusable-sections-api-client';
import { reusableSectionQueryOptions } from './reusable-sections-queries';
import type { SaveStatus } from './save-status';

// No debounce here, for useSiteLayoutSectionEditor's reason:
// canvas-editor-shell.tsx already debounces property and text changes.
export function useReusableSectionEditor(sectionId: string) {
  const queryOptions = reusableSectionQueryOptions(sectionId);
  const { data: section } = useSuspenseQuery(queryOptions);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

  const saveDraftMutation = useMutation({
    mutationFn: (content: Block[]) => saveDraft(section.id, content),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryOptions.queryKey, updated);
      setStatus({ kind: 'saved', at: Date.now() });
    },
    onError: (error: unknown) =>
      setStatus({ kind: 'error', message: String(error) }),
  });

  const publishMutation = useMutation({
    mutationFn: async (content: Block[]) => {
      await saveDraft(section.id, content);
      return publishReusableSection(section.id);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryOptions.queryKey, updated);
      setStatus({ kind: 'published' });
    },
    onError: (error: unknown) =>
      setStatus({ kind: 'error', message: String(error) }),
  });

  // Its own mutation and not part of the draft: which fields an instance
  // may change is a rule about editing, not content, and it takes effect
  // without republishing (see the entity).
  const exposedFieldsMutation = useMutation({
    mutationFn: (exposedFields: ExposedFields) =>
      setExposedFields(section.id, exposedFields),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryOptions.queryKey, updated);
    },
    onError: (error: unknown) =>
      setStatus({ kind: 'error', message: String(error) }),
  });

  const handleChange = useCallback(
    (content: Block[]) => saveDraftMutation.mutate(content),
    [saveDraftMutation],
  );

  const handlePublish = useCallback(
    (content: Block[]) => publishMutation.mutateAsync(content),
    [publishMutation],
  );

  /** Turns one field of one inner block on or off for every instance. */
  const toggleExposedField = useCallback(
    (blockId: string, field: string) => {
      const current = section.exposedFields[blockId] ?? [];
      const next = current.includes(field)
        ? current.filter((key) => key !== field)
        : [...current, field];
      const exposedFields: ExposedFields = { ...section.exposedFields };
      if (next.length === 0) {
        delete exposedFields[blockId];
      } else {
        exposedFields[blockId] = next;
      }
      exposedFieldsMutation.mutate(exposedFields);
    },
    [section.exposedFields, exposedFieldsMutation],
  );

  // See usePageGroupEditor: derived from the mutation rather than recorded,
  // so "what is happening" and "what last happened" cannot disagree.
  const isSaving = saveDraftMutation.isPending;

  return {
    section,
    status: isSaving ? ({ kind: 'saving' } as const) : status,
    isSaving,
    handleChange,
    handlePublish,
    toggleExposedField,
  };
}
