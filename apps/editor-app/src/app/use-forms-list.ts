import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  createForm as apiCreateForm,
  deleteForm as apiDeleteForm,
} from '../lib/forms-api-client.js';

// Same split as usePagesList: fetching the list is the route loader's job
// (see routes/_shell.forms.index.tsx), this hook only owns the actions
// available from the forms list screen.
export function useFormsList(siteId: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['forms', siteId] }),
    [queryClient, siteId],
  );

  const createFormMutation = useMutation({
    mutationFn: (name: string) => apiCreateForm({ siteId, name }),
    onSuccess: async (form) => {
      await invalidateList();
      await navigate({ to: '/forms/$formId', params: { formId: form.id } });
    },
  });

  const deleteFormMutation = useMutation({
    mutationFn: (formId: string) => apiDeleteForm(formId),
    onSuccess: invalidateList,
  });

  return {
    createForm: createFormMutation.mutateAsync,
    isCreating: createFormMutation.isPending,
    deleteForm: deleteFormMutation.mutateAsync,
    isDeleting: deleteFormMutation.isPending,
  };
}
