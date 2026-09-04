import { queryOptions } from '@tanstack/react-query';
import { fetchThemeForegroundTokens } from '../lib/theme-api-client';

/**
 * The same reason and pattern as `blockStyleDefaultsQueryOptions` — a given
 * theme's tokens do not change at runtime, and `themeName` in the key
 * (docs/adr/0042) makes changing theme refetch.
 */
export function themeForegroundTokensQueryOptions(themeName: string) {
  return queryOptions({
    queryKey: ['theme-foreground-tokens', themeName] as const,
    queryFn: () => fetchThemeForegroundTokens(themeName),
    enabled: themeName !== '',
    staleTime: Infinity,
  });
}
