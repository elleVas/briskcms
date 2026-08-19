import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTranslation as apiCreateTranslation,
  type CreateTranslationInput,
} from '../lib/pages-api-client.js';
import { pageTranslationsQueryOptions } from './pages-queries.js';
import { siteQueryOptions } from './site-queries.js';

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

  return {
    translations: translationsQuery.data ?? [],
    isLoading: translationsQuery.isLoading,
    enabledLocales: siteQuery.data?.enabledLocales ?? [],
    createTranslation: createTranslationMutation.mutateAsync,
    isCreating: createTranslationMutation.isPending,
  };
}
