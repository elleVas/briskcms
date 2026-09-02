import { queryOptions } from '@tanstack/react-query';
import type { ThemeBlockEntry } from '@brisk/shared-types';
import i18next from '../i18n';
import { fetchThemePageBlocks } from '../lib/theme-api-client';

/**
 * Docs/adr/0041 — same `staleTime: Infinity` posture as the other
 * theme-* queries (a theme's own blocks don't change at runtime,
 * `BRISK_THEME` is build-time-only, docs/adr/0021). This queryFn also
 * does the one thing every sibling query doesn't need: merge each
 * entry's `locales` fragment into i18next itself, `deep`+`overwrite`
 * (i18next's own params for this) so it layers over — never clobbers —
 * the ~50 core block keys already loaded at startup (`../i18n.ts`).
 * Every block label already resolves via `tLabel()`
 * (`t(key, {defaultValue: key})`, `../lib/use-translation.ts`), which
 * accepts a plain string key — no type augmentation needed for a key
 * i18next only learns about at runtime. Run once per session, same as
 * the fetch itself: re-registering the same bundle on a refetch would be
 * harmless (i18next's `addResourceBundle` is idempotent for identical
 * data) but `staleTime: Infinity` means that never actually happens.
 */
function registerThemeBlockLocales(entries: ThemeBlockEntry[]): void {
  for (const entry of entries) {
    const key = `${entry.descriptor.type.charAt(0).toLowerCase()}${entry.descriptor.type.slice(1)}`;
    for (const locale of ['en', 'it'] as const) {
      i18next.addResourceBundle(
        locale,
        'translation',
        { blocks: { [key]: entry.locales[locale] } },
        true,
        true,
      );
    }
  }
}

export function themePageBlocksQueryOptions() {
  return queryOptions({
    queryKey: ['theme-page-blocks'] as const,
    queryFn: async () => {
      const entries = await fetchThemePageBlocks();
      registerThemeBlockLocales(entries);
      return entries;
    },
    staleTime: Infinity,
  });
}
