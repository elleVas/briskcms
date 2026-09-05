import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateBusinessInfo as apiUpdateBusinessInfo,
  type UpdateBusinessInfoInput,
} from '../lib/sites-api-client';
import { siteQueryOptions } from './site-queries';

export function useSiteBusinessInfo(siteId: string) {
  const queryClient = useQueryClient();

  const updateBusinessInfoMutation = useMutation({
    mutationFn: (input: UpdateBusinessInfoInput) =>
      apiUpdateBusinessInfo(siteId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(siteQueryOptions().queryKey, updated);
    },
  });

  return {
    updateBusinessInfo: updateBusinessInfoMutation.mutateAsync,
    isSaving: updateBusinessInfoMutation.isPending,
  };
}
