import { useCallback, useState } from 'react';
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import {
  mergeTranslatedContent,
  type Block,
  type FieldValueOverlay,
} from '@brisk/shared-types';
import {
  divergePageTranslation,
  publishPageTranslation,
  saveDivergedPageTranslationContent,
  savePageGroupContent,
  savePageTranslationFieldValues,
  type PageTranslationRecord,
} from '../lib/page-groups-api-client';
import {
  pageGroupQueryOptions,
  pageGroupTranslationsQueryOptions,
} from './page-groups-queries';
import { useSingleFlightSave } from './use-single-flight-save';
import type { SaveStatus } from './save-status';

export type { SaveStatus };

/** Replaces one translation by id in a cached list — shared by every mutation below that only ever touches one locale at a time. */
function replaceTranslation(
  translations: PageTranslationRecord[] | undefined,
  updated: PageTranslationRecord,
): PageTranslationRecord[] {
  return (translations ?? []).map((translation) =>
    translation.id === updated.id ? updated : translation,
  );
}

/**
 * Writes one updated translation into the SAME `pageGroupTranslationsQueryOptions(groupId)`
 * cache entry this hook itself reads via useSuspenseQuery — exported so
 * other mutations scoped to a single translation (SEO panel, translations-
 * management dialog) stay in sync with the editor without each owning a
 * second, divergent copy of this replace-by-id logic.
 */
export function useUpdateTranslationsCache(groupId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    (updated: PageTranslationRecord) => {
      queryClient.setQueryData(
        pageGroupTranslationsQueryOptions(groupId).queryKey,
        (prev) => replaceTranslation(prev, updated),
      );
    },
    [queryClient, groupId],
  );
}

/**
 * i18n a livello di campo (see the plan) — orchestrates a PageGroup +
 * ITS translations, mirroring usePageEditor's role for the old Page model
 * but with two independent save targets instead of one:
 * - structural changes (insert/remove/reorder/non-translatable props, or
 *   ANY change on a diverged translation) go through `onChange`, which
 *   routes to savePageGroupContent for a linked translation or
 *   saveDivergedPageTranslationContent for a diverged one — CanvasEditorShell
 *   doesn't need to know which, `onChange`'s target already reflects it.
 * - a translatable-field edit at a non-default locale goes through
 *   `onSaveFieldValue` instead (see canvas-editor-shell.tsx's own
 *   `translationRouting` prop, which decides WHEN to call this one instead
 *   of `onChange` — this hook only owns WHERE each path persists to).
 */
export function usePageGroupEditor(groupId: string, initialLocale: string) {
  const { data: group } = useSuspenseQuery(pageGroupQueryOptions(groupId));
  const { data: translations } = useSuspenseQuery(
    pageGroupTranslationsQueryOptions(groupId),
  );
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [activeLocale, setActiveLocale] = useState(initialLocale);

  // Falls back to whatever locale IS there if the requested one somehow
  // isn't (e.g. a stale deep link to a locale that's since been removed) —
  // a group is never created without at least one translation (see
  // createPageGroupTranslation), so `translations` is never empty here.
  const activeTranslation =
    translations.find((t) => t.locale === activeLocale) ?? translations[0];

  const displayedBlocks: Block[] = activeTranslation.isDiverged
    ? (activeTranslation.divergedContent ?? [])
    : mergeTranslatedContent(group.content, activeTranslation.fieldValues);

  const updateTranslationsCache = useUpdateTranslationsCache(groupId);

  const saveGroupContentMutation = useMutation({
    mutationFn: (content: Block[]) => savePageGroupContent(groupId, content),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        pageGroupQueryOptions(groupId).queryKey,
        updated,
      );
      setStatus({ kind: 'saved' });
    },
    onError: (error: unknown) =>
      setStatus({ kind: 'error', message: String(error) }),
  });

  const saveDivergedContentMutation = useMutation({
    mutationFn: ({
      translationId,
      content,
    }: {
      translationId: string;
      content: Block[];
    }) =>
      saveDivergedPageTranslationContent(
        translationId,
        content,
        group.parentId,
      ),
    onSuccess: (updated) => {
      updateTranslationsCache(updated);
      setStatus({ kind: 'saved' });
    },
    onError: (error: unknown) =>
      setStatus({ kind: 'error', message: String(error) }),
  });

  // Single funnel for every structural change, keyed to whichever target
  // is correct for the CURRENTLY active translation at the moment a save
  // actually flushes — see this file's own top comment for the narrow
  // (accepted) race if the user switches locale between scheduling and
  // flushing a save, same risk profile as switching pages already had.
  const onChange = useSingleFlightSave<Block[]>(
    useCallback(
      (content) =>
        activeTranslation.isDiverged
          ? saveDivergedContentMutation.mutateAsync({
              translationId: activeTranslation.id,
              content,
            })
          : saveGroupContentMutation.mutateAsync(content),
      [
        activeTranslation.isDiverged,
        activeTranslation.id,
        saveDivergedContentMutation,
        saveGroupContentMutation,
      ],
    ),
  );

  const saveFieldValuesMutation = useMutation({
    mutationFn: ({
      translationId,
      fieldValues,
    }: {
      translationId: string;
      fieldValues: FieldValueOverlay;
    }) =>
      savePageTranslationFieldValues(
        translationId,
        fieldValues,
        group.parentId,
      ),
    onSuccess: (updated) => {
      updateTranslationsCache(updated);
      setStatus({ kind: 'saved' });
    },
    onError: (error: unknown) =>
      setStatus({ kind: 'error', message: String(error) }),
  });

  const scheduleFieldValuesSave = useSingleFlightSave<{
    translationId: string;
    fieldValues: FieldValueOverlay;
  }>(
    useCallback(
      (value) => saveFieldValuesMutation.mutateAsync(value),
      [saveFieldValuesMutation],
    ),
  );

  const onSaveFieldValue = useCallback(
    (blockId: string, field: string, value: string) => {
      const nextFieldValues: FieldValueOverlay = {
        ...activeTranslation.fieldValues,
        [blockId]: {
          ...activeTranslation.fieldValues[blockId],
          [field]: value,
        },
      };
      // Optical update of the cached translation too — without this, a
      // fast switch away and back to this locale before the save round-trip
      // completes would briefly show the OLD value again (the merge below
      // reads straight from this same cache).
      updateTranslationsCache({
        ...activeTranslation,
        fieldValues: nextFieldValues,
      });
      scheduleFieldValuesSave({
        translationId: activeTranslation.id,
        fieldValues: nextFieldValues,
      });
    },
    [activeTranslation, scheduleFieldValuesSave, updateTranslationsCache],
  );

  const publishMutation = useMutation({
    mutationFn: (translationId: string) =>
      publishPageTranslation(translationId),
    onSuccess: (updated) => {
      updateTranslationsCache(updated);
      queryClient.invalidateQueries({ queryKey: ['page-groups'] });
      setStatus({ kind: 'published' });
    },
    onError: (error: unknown) =>
      setStatus({ kind: 'error', message: String(error) }),
  });
  const handlePublish = useCallback(
    () => publishMutation.mutateAsync(activeTranslation.id),
    [publishMutation, activeTranslation.id],
  );

  const divergeMutation = useMutation({
    mutationFn: (translationId: string) =>
      divergePageTranslation(translationId),
    onSuccess: (updated) => {
      updateTranslationsCache(updated);
      setStatus({ kind: 'saved' });
    },
    onError: (error: unknown) =>
      setStatus({ kind: 'error', message: String(error) }),
  });
  const handleDiverge = useCallback(
    () => divergeMutation.mutateAsync(activeTranslation.id),
    [divergeMutation, activeTranslation.id],
  );

  return {
    group,
    translations,
    activeLocale,
    setActiveLocale,
    activeTranslation,
    displayedBlocks,
    status,
    onChange,
    onSaveFieldValue,
    handlePublish,
    handleDiverge,
  };
}
