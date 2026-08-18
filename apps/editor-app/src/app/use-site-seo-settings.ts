import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateSeoSettings as apiUpdateSeoSettings,
  type UpdateSeoSettingsInput,
} from '../lib/sites-api-client.js';
import { siteQueryOptions } from './site-queries.js';

export function useSiteSeoSettings(siteId: string) {
  const queryClient = useQueryClient();

  const updateSeoSettingsMutation = useMutation({
    mutationFn: (input: UpdateSeoSettingsInput) =>
      apiUpdateSeoSettings(siteId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(siteQueryOptions(siteId).queryKey, updated);
    },
  });

  return {
    updateSeoSettings: updateSeoSettingsMutation.mutateAsync,
    isSaving: updateSeoSettingsMutation.isPending,
  };
}
