import { queryOptions } from '@tanstack/react-query';
import { fetchThemeBaseTokens } from '../lib/theme-api-client';

/**
 * Stesso motivo/pattern di `themeForegroundTokensQueryOptions` — i token
 * di un dato tema non cambiano a runtime, e `themeName` nella chiave
 * (docs/adr/0042) fa sì che cambiare tema rifaccia la fetch invece di
 * riusare quelli del tema precedente.
 */
export function themeBaseTokensQueryOptions(themeName: string) {
  return queryOptions({
    queryKey: ['theme-base-tokens', themeName] as const,
    queryFn: () => fetchThemeBaseTokens(themeName),
    enabled: themeName !== '',
    staleTime: Infinity,
  });
}
