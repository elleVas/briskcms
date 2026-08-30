import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  computeContentStructureSignature,
  type PageRecord,
} from '@brisk/shared-types';
import {
  createTranslation as apiCreateTranslation,
  markTranslationSynced as apiMarkTranslationSynced,
  type CreateTranslationInput,
} from '../lib/pages-api-client';
import { pageTranslationsQueryOptions } from './pages-queries';
import { siteQueryOptions } from './site-queries';

export interface PageTranslationSummary extends PageRecord {
  /**
   * True when this page's own `syncedStructureSignature` no longer
   * matches the group's default-locale sibling's CURRENT block structure
   * — someone added/removed/reordered blocks on the original since this
   * translation was last created or explicitly marked synced (see
   * content-structure-signature.ts). Always `false` for the default-locale
   * page itself and whenever that sibling can't be found in the group
   * (nothing to compare against).
   */
  hasStructuralDrift: boolean;
}

// `enabled` keeps both queries lazy: fetched only once the translations
// dialog is actually opened, not on every editor page load (same reasoning
// as usePageVersions).
export function usePageTranslations(
  pageId: string,
  siteId: string,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const translationsQuery = useQuery({
    ...pageTranslationsQueryOptions(pageId),
    enabled,
  });
  const siteQuery = useQuery({ ...siteQueryOptions(siteId), enabled });
  const defaultLocale = siteQuery.data?.defaultLocale;

  const referenceSignature = useMemo(() => {
    const reference = translationsQuery.data?.find(
      (page) => page.locale === defaultLocale,
    );
    return reference
      ? computeContentStructureSignature(reference.content)
      : null;
  }, [translationsQuery.data, defaultLocale]);

  const translations = useMemo<PageTranslationSummary[]>(
    () =>
      (translationsQuery.data ?? []).map((page) => ({
        ...page,
        hasStructuralDrift:
          page.locale !== defaultLocale &&
          referenceSignature !== null &&
          page.syncedStructureSignature !== referenceSignature,
      })),
    [translationsQuery.data, defaultLocale, referenceSignature],
  );

  const createTranslationMutation = useMutation({
    mutationFn: (input: CreateTranslationInput) =>
      apiCreateTranslation(pageId, input),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: pageTranslationsQueryOptions(pageId).queryKey,
      });
      // Partial key: invalidates every cached page of list results for
      // this site (see pages-queries.ts), same as usePageVersions' rollback.
      queryClient.invalidateQueries({ queryKey: ['pages', created.siteId] });
    },
  });

  const markSyncedMutation = useMutation({
    mutationFn: (translationId: string) => {
      if (referenceSignature === null) {
        throw new Error('No default-locale page to sync against');
      }
      return apiMarkTranslationSynced(translationId, referenceSignature);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: pageTranslationsQueryOptions(pageId).queryKey,
      });
    },
  });

  return {
    translations,
    isLoading: translationsQuery.isLoading,
    enabledLocales: siteQuery.data?.enabledLocales ?? [],
    createTranslation: createTranslationMutation.mutateAsync,
    isCreating: createTranslationMutation.isPending,
    markSynced: markSyncedMutation.mutateAsync,
    isMarkingSynced: markSyncedMutation.isPending,
  };
}
