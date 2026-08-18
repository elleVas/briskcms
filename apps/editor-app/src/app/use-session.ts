import { useCallback } from 'react';
import {
  login as apiLogin,
  logout as apiLogout,
} from '../lib/auth-api-client.js';

export function useSession() {
  // Errors intentionally propagate to the caller (LoginForm shows them).
  const handleLogin = useCallback(
    (email: string, password: string) => apiLogin(email, password),
    [],
  );

  // Best-effort: even if the server call fails (e.g. the session already
  // expired), the caller still treats the user as logged out locally — the
  // `catch` here is what actually makes it best-effort; a bare `finally`
  // would still leave the rejection unhandled.
  const handleLogout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // ignored on purpose, see comment above
    }
  }, []);

  return { handleLogin, handleLogout };
}
