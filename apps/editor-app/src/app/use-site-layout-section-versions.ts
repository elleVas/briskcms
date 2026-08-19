import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  rollbackToVersion,
  type SiteLayoutSectionKind,
} from '../lib/site-layout-sections-api-client.js';
import {
  siteLayoutSectionQueryOptions,
  siteLayoutSectionVersionsQueryOptions,
} from './site-layout-sections-queries.js';

// `enabled` keeps this lazy: the list is only fetched once the version
// history dialog is actually opened, not on every editor page load — same
// reasoning as usePageVersions.
export function useSiteLayoutSectionVersions(
  id: string,
  siteId: string,
  locale: string,
  kind: SiteLayoutSectionKind,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const versionsQuery = useQuery({
    ...siteLayoutSectionVersionsQueryOptions(id),
    enabled,
  });

  const rollbackMutation = useMutation({
    mutationFn: (versionId: string) => rollbackToVersion(id, versionId),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        siteLayoutSectionQueryOptions(siteId, locale, kind).queryKey,
        updated,
      );
      queryClient.invalidateQueries({
        queryKey: siteLayoutSectionVersionsQueryOptions(id).queryKey,
      });
    },
  });

  return {
    versions: versionsQuery.data ?? [],
    isLoading: versionsQuery.isLoading,
    rollback: rollbackMutation.mutateAsync,
  };
}
