import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rollbackPageGroupToVersion } from '../lib/page-groups-api-client';
import {
  pageGroupQueryOptions,
  pageGroupVersionsQueryOptions,
} from './page-groups-queries';

/**
 * Version history for the shared PageGroup structure only — a diverged
 * translation's own `divergedContent` isn't tracked by any version stream
 * yet (a real, accepted gap, see the Fase 0-3 memory), so the version-
 * history button always shows/restores the group's structure regardless
 * of which locale is active. `enabled` keeps this lazy, same reasoning as
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
