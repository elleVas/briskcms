import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ResponsiveBlockStyle } from '@brisk/shared-types';
import { updateThemeTokens as apiUpdateThemeTokens } from '../lib/sites-api-client';
import { siteQueryOptions } from './site-queries';

export function useSiteThemeTokens(siteId: string) {
  const queryClient = useQueryClient();

  const updateThemeTokensMutation = useMutation({
    mutationFn: (input: {
      blockType: string;
      variant: string;
      style: ResponsiveBlockStyle;
    }) =>
      apiUpdateThemeTokens(siteId, input.blockType, input.variant, input.style),
    onSuccess: (updated) => {
      queryClient.setQueryData(siteQueryOptions().queryKey, updated);
    },
  });

  return {
    updateThemeTokens: updateThemeTokensMutation.mutateAsync,
    isSaving: updateThemeTokensMutation.isPending,
  };
}
