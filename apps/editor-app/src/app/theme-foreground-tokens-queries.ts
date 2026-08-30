import { queryOptions } from '@tanstack/react-query';
import { fetchThemeForegroundTokens } from '../lib/theme-api-client';

/**
 * Stesso motivo/pattern di `blockStyleDefaultsQueryOptions` — il tema
 * attivo non cambia mai a runtime (docs/adr/0021), una sola fetch per
 * sessione basta.
 */
export function themeForegroundTokensQueryOptions() {
  return queryOptions({
    queryKey: ['theme-foreground-tokens'] as const,
    queryFn: fetchThemeForegroundTokens,
    staleTime: Infinity,
  });
}
