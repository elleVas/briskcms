import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BlockStyleOverride } from '@brisk/shared-types';
import { updateThemeTokens as apiUpdateThemeTokens } from '../lib/sites-api-client.js';
import { siteQueryOptions } from './site-queries.js';

export function useSiteThemeTokens(siteId: string) {
  const queryClient = useQueryClient();

  const updateThemeTokensMutation = useMutation({
    mutationFn: (input: { blockType: string; style: BlockStyleOverride }) =>
      apiUpdateThemeTokens(siteId, input.blockType, input.style),
    onSuccess: (updated) => {
      queryClient.setQueryData(siteQueryOptions(siteId).queryKey, updated);
    },
  });

  return {
    updateThemeTokens: updateThemeTokensMutation.mutateAsync,
    isSaving: updateThemeTokensMutation.isPending,
  };
}
