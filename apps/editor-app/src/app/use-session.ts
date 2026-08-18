import { useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  login as apiLogin,
  logout as apiLogout,
} from '../lib/auth-api-client.js';

export function useSession() {
  const navigate = useNavigate();

  // Errors intentionally propagate to the caller (LoginForm shows them).
  const handleLogin = useCallback(
    (email: string, password: string) => apiLogin(email, password),
    [],
  );

  // Best-effort: even if the server call fails (e.g. the session already
  // expired), the user still lands back on /login — the `catch` here is
  // what actually makes it best-effort; a bare `finally` would still leave
  // the rejection unhandled. Owns the redirect itself (rather than leaving
  // it to each caller) since "logging out always returns to /login" is a
  // single, non-negotiable policy, not a per-caller choice.
  const handleLogout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // ignored on purpose, see comment above
    }
    await navigate({ to: '/login' });
  }, [navigate]);

  return { handleLogin, handleLogout };
}
