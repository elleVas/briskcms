import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { login as apiLogin, logout as apiLogout } from '../lib/auth-api-client';

export function useSession() {
  const navigate = useNavigate();

  // Errors intentionally propagate to the caller (LoginForm shows them).
  const loginMutation = useMutation({
    mutationFn: ({
      email,
      password,
      captchaToken,
    }: {
      email: string;
      password: string;
      captchaToken: string;
    }) => apiLogin(email, password, captchaToken),
  });

  // Always redirects, whether or not the server call actually succeeded
  // (e.g. the session already expired) — logging out always lands on
  // /login, that's a single, non-negotiable policy, not a per-caller
  // choice.
  const logoutMutation = useMutation({
    mutationFn: () => apiLogout(),
    onSettled: () => navigate({ to: '/login' }),
  });

  const handleLogin = useCallback(
    (email: string, password: string, captchaToken: string) =>
      loginMutation.mutateAsync({ email, password, captchaToken }),
    [loginMutation],
  );

  // Best-effort: even if the server call fails, the caller still gets a
  // resolved promise — the redirect in onSettled above already happened
  // either way, so there is nothing left for the caller to react to.
  const handleLogout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // ignored on purpose, see comment above
    }
  }, [logoutMutation]);

  return { handleLogin, handleLogout };
}
