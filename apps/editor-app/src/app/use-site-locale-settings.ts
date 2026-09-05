import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LocaleSettings } from '@brisk/shared-types';
import { updateLocaleSettings as apiUpdateLocaleSettings } from '../lib/sites-api-client';
import { siteQueryOptions } from './site-queries';

export function useSiteLocaleSettings(siteId: string) {
  const queryClient = useQueryClient();

  const updateLocaleSettingsMutation = useMutation({
    mutationFn: (input: LocaleSettings) =>
      apiUpdateLocaleSettings(siteId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(siteQueryOptions().queryKey, updated);
    },
  });

  return {
    updateLocaleSettings: updateLocaleSettingsMutation.mutateAsync,
    isSaving: updateLocaleSettingsMutation.isPending,
  };
}
