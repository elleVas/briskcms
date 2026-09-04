import { queryOptions } from '@tanstack/react-query';
import { fetchBlockStyleDefaults } from '../lib/theme-api-client';

/**
 * Il default risolto di ogni tipo di blocco dipende dai token del tema
 * attivo e non cambia mai a runtime per un dato tema — `staleTime:
 * Infinity`, con `themeName` nella chiave così un cambio tema rifà la
 * fetch da solo (docs/adr/0042). Stesso pattern di
 * themeIconsQueryOptions.
 */
export function blockStyleDefaultsQueryOptions(themeName: string) {
  return queryOptions({
    queryKey: ['block-style-defaults', themeName] as const,
    queryFn: () => fetchBlockStyleDefaults(themeName),
    enabled: themeName !== '',
    staleTime: Infinity,
  });
}
