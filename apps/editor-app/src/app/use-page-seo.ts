import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SeoMeta } from '@brisk/shared-types';
import { updateSeoMeta as apiUpdateSeoMeta } from '../lib/pages-api-client.js';
import { pageQueryOptions } from './pages-queries.js';

export function usePageSeo(pageId: string) {
  const queryClient = useQueryClient();

  const updateSeoMetaMutation = useMutation({
    mutationFn: (seoMeta: SeoMeta) => apiUpdateSeoMeta(pageId, seoMeta),
    onSuccess: (updated) => {
      queryClient.setQueryData(pageQueryOptions(pageId).queryKey, updated);
    },
  });

  return {
    updateSeoMeta: updateSeoMetaMutation.mutateAsync,
    isSaving: updateSeoMetaMutation.isPending,
  };
}
