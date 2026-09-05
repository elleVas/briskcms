import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateGeneralSettings as apiUpdateGeneralSettings,
  type UpdateGeneralSettingsInput,
} from '../lib/sites-api-client';
import { siteQueryOptions } from './site-queries';

export function useSiteGeneralSettings(siteId: string) {
  const queryClient = useQueryClient();

  const updateGeneralSettingsMutation = useMutation({
    mutationFn: (input: UpdateGeneralSettingsInput) =>
      apiUpdateGeneralSettings(siteId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(siteQueryOptions().queryKey, updated);
    },
  });

  return {
    updateGeneralSettings: updateGeneralSettingsMutation.mutateAsync,
    isSaving: updateGeneralSettingsMutation.isPending,
  };
}
