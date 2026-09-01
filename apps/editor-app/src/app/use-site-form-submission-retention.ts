import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateFormSubmissionRetention as apiUpdateFormSubmissionRetention,
  type UpdateFormSubmissionRetentionInput,
} from '../lib/sites-api-client';
import { siteQueryOptions } from './site-queries';

export function useSiteFormSubmissionRetention(siteId: string) {
  const queryClient = useQueryClient();

  const updateFormSubmissionRetentionMutation = useMutation({
    mutationFn: (input: UpdateFormSubmissionRetentionInput) =>
      apiUpdateFormSubmissionRetention(siteId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(siteQueryOptions(siteId).queryKey, updated);
    },
  });

  return {
    updateFormSubmissionRetention:
      updateFormSubmissionRetentionMutation.mutateAsync,
    isSaving: updateFormSubmissionRetentionMutation.isPending,
  };
}
