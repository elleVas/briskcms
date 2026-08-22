import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ThemeTokens } from '@brisk/shared-types';
import { updateThemeTokens as apiUpdateThemeTokens } from '../lib/sites-api-client.js';
import { siteQueryOptions } from './site-queries.js';

export function useSiteThemeTokens(siteId: string) {
  const queryClient = useQueryClient();

  const updateThemeTokensMutation = useMutation({
    mutationFn: (input: Partial<ThemeTokens>) =>
      apiUpdateThemeTokens(siteId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(siteQueryOptions(siteId).queryKey, updated);
    },
  });

  return {
    updateThemeTokens: updateThemeTokensMutation.mutateAsync,
    isSaving: updateThemeTokensMutation.isPending,
  };
}
