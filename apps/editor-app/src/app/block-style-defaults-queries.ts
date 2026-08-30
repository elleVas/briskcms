import { queryOptions } from '@tanstack/react-query';
import { fetchBlockStyleDefaults } from '../lib/theme-api-client';

/**
 * Il default risolto di ogni tipo di blocco non cambia mai a runtime
 * (`BRISK_THEME` è una env var risolta a build time, docs/adr/0021) —
 * `staleTime: Infinity` così una sola fetch per sessione basta, stesso
 * pattern di themeIconsQueryOptions.
 */
export function blockStyleDefaultsQueryOptions() {
  return queryOptions({
    queryKey: ['block-style-defaults'] as const,
    queryFn: fetchBlockStyleDefaults,
    staleTime: Infinity,
  });
}
