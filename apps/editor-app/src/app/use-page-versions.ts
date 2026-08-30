import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rollbackToVersion } from '../lib/pages-api-client';
import { pageQueryOptions, pageVersionsQueryOptions } from './pages-queries';

// `enabled` keeps this lazy: the list is only fetched once the version
// history dialog is actually opened, not on every editor page load.
export function usePageVersions(pageId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const versionsQuery = useQuery({
    ...pageVersionsQueryOptions(pageId),
    enabled,
  });

  const rollbackMutation = useMutation({
    mutationFn: (versionId: string) => rollbackToVersion(pageId, versionId),
    onSuccess: (updated) => {
      queryClient.setQueryData(pageQueryOptions(pageId).queryKey, updated);
      queryClient.invalidateQueries({
        queryKey: pageVersionsQueryOptions(pageId).queryKey,
      });
      // Partial key: invalidates every cached page of list results for
      // this site (see pages-queries.ts), not just one page number.
      queryClient.invalidateQueries({ queryKey: ['pages', updated.siteId] });
    },
  });

  return {
    versions: versionsQuery.data ?? [],
    isLoading: versionsQuery.isLoading,
    rollback: rollbackMutation.mutateAsync,
  };
}
