import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rollbackPageGroupToVersion } from '../lib/page-groups-api-client';
import {
  pageGroupQueryOptions,
  pageGroupVersionsQueryOptions,
} from './page-groups-queries';

/**
 * Version history for the shared PageGroup structure — every language
 * that follows it. A language's own content has its own history, see
 * usePageTranslationVersions. `enabled` keeps this lazy, same reasoning as
 * the old usePageVersions: only fetched once the dialog is actually open.
 */
export function usePageGroupVersions(groupId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const versionsQuery = useQuery({
    ...pageGroupVersionsQueryOptions(groupId),
    enabled,
  });

  const rollbackMutation = useMutation({
    mutationFn: (versionId: string) =>
      rollbackPageGroupToVersion(groupId, versionId),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        pageGroupQueryOptions(groupId).queryKey,
        updated,
      );
      queryClient.invalidateQueries({
        queryKey: pageGroupVersionsQueryOptions(groupId).queryKey,
      });
    },
  });

  return {
    versions: versionsQuery.data ?? [],
    isLoading: versionsQuery.isLoading,
    rollback: rollbackMutation.mutateAsync,
  };
}
