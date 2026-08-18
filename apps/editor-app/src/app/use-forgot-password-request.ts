import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { requestPasswordReset } from '../lib/auth-api-client.js';

export function useForgotPasswordRequest() {
  const mutation = useMutation({
    mutationFn: (email: string) => requestPasswordReset(email),
  });

  // Always resolves as "sent", whether the request succeeded, the email
  // didn't match an account, or the call itself failed — same
  // anti-enumeration principle the backend already enforces (see
  // requestPasswordReset use-case), so the caller never has to branch on it.
  const requestReset = useCallback(
    async (email: string) => {
      try {
        await mutation.mutateAsync(email);
      } catch {
        // ignored on purpose, see comment above
      }
    },
    [mutation],
  );

  return { requestReset, isSubmitting: mutation.isPending };
}
