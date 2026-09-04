import { queryOptions } from '@tanstack/react-query';
import { fetchThemeForegroundTokens } from '../lib/theme-api-client';

/**
 * Stesso motivo/pattern di `blockStyleDefaultsQueryOptions` — i token di
 * un dato tema non cambiano a runtime, e `themeName` nella chiave
 * (docs/adr/0042) fa sì che cambiare tema rifaccia la fetch.
 */
export function themeForegroundTokensQueryOptions(themeName: string) {
  return queryOptions({
    queryKey: ['theme-foreground-tokens', themeName] as const,
    queryFn: () => fetchThemeForegroundTokens(themeName),
    enabled: themeName !== '',
    staleTime: Infinity,
  });
}
