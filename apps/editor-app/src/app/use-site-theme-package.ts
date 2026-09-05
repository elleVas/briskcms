import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateThemePackage as apiUpdateThemePackage,
  type UpdateThemePackageInput,
} from '../lib/sites-api-client';
import { siteQueryOptions } from './site-queries';

export function useSiteThemePackage(siteId: string) {
  const queryClient = useQueryClient();

  const updateThemePackageMutation = useMutation({
    mutationFn: (input: UpdateThemePackageInput) =>
      apiUpdateThemePackage(siteId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(siteQueryOptions().queryKey, updated);
    },
  });

  return {
    updateThemePackage: updateThemePackageMutation.mutateAsync,
    isSaving: updateThemePackageMutation.isPending,
  };
}
