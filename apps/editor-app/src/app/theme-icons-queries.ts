import { queryOptions } from '@tanstack/react-query';
import { fetchThemeIcons } from '../lib/theme-api-client';

/**
 * ONE theme's icon set never changes at runtime (the theme's files are in
 * the image) — `staleTime: Infinity`, so a single fetch per theme per
 * session is enough (docs/adr/0023), with no refetch every time the picker
 * opens. Since docs/adr/0042 the key includes `themeName`: changing the
 * site's theme is a different key, and therefore an automatic refetch
 * rather than a stale cache. `enabled` until the theme is known: no data is
 * better than the wrong theme's.
 */
export function themeIconsQueryOptions(themeName: string) {
  return queryOptions({
    queryKey: ['theme-icons', themeName] as const,
    queryFn: () => fetchThemeIcons(themeName),
    enabled: themeName !== '',
    staleTime: Infinity,
  });
}
