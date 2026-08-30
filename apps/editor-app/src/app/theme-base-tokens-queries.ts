import { queryOptions } from '@tanstack/react-query';
import { fetchThemeBaseTokens } from '../lib/theme-api-client.js';

/**
 * Stesso motivo/pattern di `themeForegroundTokensQueryOptions` — il tema
 * attivo non cambia mai a runtime (docs/adr/0021), una sola fetch per
 * sessione basta.
 */
export function themeBaseTokensQueryOptions() {
  return queryOptions({
    queryKey: ['theme-base-tokens'] as const,
    queryFn: fetchThemeBaseTokens,
    staleTime: Infinity,
  });
}
