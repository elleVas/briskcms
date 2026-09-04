import { queryOptions } from '@tanstack/react-query';
import { fetchThemeBaseTokens } from '../lib/theme-api-client';

/**
 * The same reason and pattern as `themeForegroundTokensQueryOptions` — a
 * given theme's tokens do not change at runtime, and `themeName` in the key
 * (docs/adr/0042) makes changing theme refetch rather than reuse the
 * previous theme's.
 */
export function themeBaseTokensQueryOptions(themeName: string) {
  return queryOptions({
    queryKey: ['theme-base-tokens', themeName] as const,
    queryFn: () => fetchThemeBaseTokens(themeName),
    enabled: themeName !== '',
    staleTime: Infinity,
  });
}
