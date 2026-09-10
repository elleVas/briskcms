import { useQuery } from '@tanstack/react-query';
import { currentSession, type CurrentSession } from '../lib/auth-api-client';

export const currentSessionQueryKey = ['auth', 'session'] as const;

/**
 * Who is logged in.
 *
 * Asked once and cached for the whole session: a role does not change
 * while somebody is using the editor, and re-asking on every screen
 * would put a request in front of a sidebar that has to be there
 * immediately.
 *
 * While it is loading, and if it fails, `role` is null — and every
 * caller must read that as "do not show the admin-only things yet"
 * rather than "show them". Guessing generously here would put the
 * screens back that this exists to hide.
 */
export function useCurrentSession(): {
  session: CurrentSession | undefined;
  role: CurrentSession['role'] | null;
  isAdmin: boolean;
} {
  const { data } = useQuery({
    queryKey: currentSessionQueryKey,
    queryFn: currentSession,
    staleTime: Infinity,
    retry: false,
  });
  return {
    session: data,
    role: data?.role ?? null,
    isAdmin: data?.role === 'admin',
  };
}
