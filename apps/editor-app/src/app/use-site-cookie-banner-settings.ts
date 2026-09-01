import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CookieBannerSettings } from '@brisk/shared-types';
import { updateCookieBannerSettings as apiUpdateCookieBannerSettings } from '../lib/sites-api-client';
import { siteQueryOptions } from './site-queries';

export function useSiteCookieBannerSettings(siteId: string) {
  const queryClient = useQueryClient();

  const updateCookieBannerSettingsMutation = useMutation({
    mutationFn: (input: CookieBannerSettings) =>
      apiUpdateCookieBannerSettings(siteId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(siteQueryOptions(siteId).queryKey, updated);
    },
  });

  return {
    updateCookieBannerSettings: updateCookieBannerSettingsMutation.mutateAsync,
    isSaving: updateCookieBannerSettingsMutation.isPending,
  };
}
