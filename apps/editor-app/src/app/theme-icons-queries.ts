import { queryOptions } from '@tanstack/react-query';
import { fetchThemeIcons } from '../lib/theme-icons-api-client.js';

/**
 * Il set di icone del tema attivo non cambia mai a runtime (`BRISK_THEME`
 * è una env var risolta a build time, docs/adr/0021) — `staleTime:
 * Infinity` così una sola fetch per sessione basta (docs/adr/0023), niente
 * refetch a ogni apertura del picker.
 */
export function themeIconsQueryOptions() {
  return queryOptions({
    queryKey: ['theme-icons'] as const,
    queryFn: fetchThemeIcons,
    staleTime: Infinity,
  });
}
