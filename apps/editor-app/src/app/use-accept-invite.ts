import { useMutation } from '@tanstack/react-query';
import { acceptInvite } from '../lib/auth-api-client.js';

export function useAcceptInvite(token: string) {
  return useMutation({
    mutationFn: (password: string) => acceptInvite(token, password),
  });
}
