import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rollbackPageTranslationToVersion } from '../lib/page-groups-api-client';
import { pageTranslationVersionsQueryOptions } from './page-groups-queries';
import { useUpdateTranslationsCache } from './use-page-group-editor';

/**
 * Version history for one language's own content — its text over the
 * shared structure, or its whole tree while it is unlinked (docs/adr/0075).
 * The counterpart to usePageGroupVersions, lazy for the same reason: only
 * fetched once the dialog is actually open.
 */
export function usePageTranslationVersions(
  groupId: string,
  translationId: string,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const updateTranslationsCache = useUpdateTranslationsCache(groupId);
  const versionsQuery = useQuery({
    ...pageTranslationVersionsQueryOptions(translationId),
    enabled,
  });

  const rollbackMutation = useMutation({
    mutationFn: (versionId: string) =>
      rollbackPageTranslationToVersion(translationId, versionId),
    onSuccess: (updated) => {
      updateTranslationsCache(updated);
      queryClient.invalidateQueries({
        queryKey: pageTranslationVersionsQueryOptions(translationId).queryKey,
      });
    },
  });

  return {
    versions: versionsQuery.data ?? [],
    isLoading: versionsQuery.isLoading,
    rollback: rollbackMutation.mutateAsync,
  };
}
