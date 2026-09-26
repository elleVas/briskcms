import { useCallback } from 'react';
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
import { useDraftEditor } from './use-draft-editor';

// No debounce here, for useSiteLayoutSectionEditor's reason:
// canvas-editor-shell.tsx already debounces property and text changes.
export function useReusableSectionEditor(sectionId: string) {
  const queryOptions = reusableSectionQueryOptions(sectionId);
  const { data: section } = useSuspenseQuery(queryOptions);
  const queryClient = useQueryClient();

  const draft = useDraftEditor({
    queryKey: queryOptions.queryKey,
    save: useCallback(
      (content: Block[]) => saveDraft(section.id, content),
      [section.id],
    ),
    publish: useCallback(
      () => publishReusableSection(section.id),
      [section.id],
    ),
  });
  const { setStatus } = draft;

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

  return {
    section,
    status: draft.status,
    isSaving: draft.isSaving,
    handleChange: draft.handleChange,
    handlePublish: draft.handlePublish,
    whenSaved: draft.whenSaved,
    toggleExposedField,
  };
}
