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
export function themeIconsQueryOptions(
  themeName: string,
  set: 'interface' | 'brand' = 'interface',
) {
  return queryOptions({
    // `set` is part of the key, so switching tabs fetches the other set
    // once and then reuses it — the brands are never requested at all
    // until somebody opens that tab.
    queryKey: ['theme-icons', themeName, set] as const,
    queryFn: () => fetchThemeIcons(themeName, set),
    enabled: themeName !== '',
    staleTime: Infinity,
  });
}
