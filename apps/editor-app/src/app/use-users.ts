import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  inviteUser as apiInviteUser,
  setUserActive as apiSetUserActive,
  updateUserRole as apiUpdateUserRole,
  type InviteUserInput,
  type UserRole,
} from '../lib/users-api-client';

// Same split as usePagesList/useMediaLibrary: fetching the list is the
// route loader's job (see routes/_shell.users.index.tsx), this hook only
// owns the actions available from the Utenti section — invite, change
// role, activate/deactivate.
export function useUsers() {
  const queryClient = useQueryClient();

  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    [queryClient],
  );

  const inviteMutation = useMutation({
    mutationFn: (input: InviteUserInput) => apiInviteUser(input),
    onSuccess: invalidateList,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      apiUpdateUserRole(id, role),
    onSuccess: invalidateList,
  });

  const setActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiSetUserActive(id, isActive),
    onSuccess: invalidateList,
  });

  return {
    inviteUser: inviteMutation.mutateAsync,
    isInviting: inviteMutation.isPending,
    updateUserRole: (id: string, role: UserRole) =>
      updateRoleMutation.mutateAsync({ id, role }),
    setUserActive: (id: string, isActive: boolean) =>
      setActiveMutation.mutateAsync({ id, isActive }),
  };
}
