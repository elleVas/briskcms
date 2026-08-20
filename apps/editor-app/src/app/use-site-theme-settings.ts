import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ThemeSettings } from '@brisk/shared-types';
import { updateThemeSettings as apiUpdateThemeSettings } from '../lib/sites-api-client.js';
import { siteQueryOptions } from './site-queries.js';

export function useSiteThemeSettings(siteId: string) {
  const queryClient = useQueryClient();

  const updateThemeSettingsMutation = useMutation({
    mutationFn: (input: ThemeSettings) => apiUpdateThemeSettings(siteId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(siteQueryOptions(siteId).queryKey, updated);
    },
  });

  return {
    updateThemeSettings: updateThemeSettingsMutation.mutateAsync,
    isSaving: updateThemeSettingsMutation.isPending,
  };
}
