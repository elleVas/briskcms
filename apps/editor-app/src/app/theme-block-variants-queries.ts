import { queryOptions } from '@tanstack/react-query';
import type { ThemeBlockVariantsResponse } from '@brisk/shared-types';
import i18next from '../i18n';
import { fetchThemeBlockVariants } from '../lib/theme-api-client';

/**
 * The looks a theme adds to core block types (ADR-0047). Same
 * `staleTime: Infinity` posture as every other theme-* query — a theme's
 * own files do not change at runtime, and `themeName` is in the key so
 * switching a site's theme refetches instead of reusing the old one's.
 *
 * Like `themePageBlocksQueryOptions`, the queryFn also registers the
 * labels into i18next: a theme cannot add keys to the editor's bundles at
 * build time, so its strings travel with the data. They land under
 * `blocks.<type>.variants.<value>` — the very key a CORE variant already
 * uses, so nothing downstream has to know where a variant came from.
 */
function registerVariantLabels(response: ThemeBlockVariantsResponse): void {
  for (const [blockType, variants] of Object.entries(response)) {
    const key = `${blockType.charAt(0).toLowerCase()}${blockType.slice(1)}`;
    for (const locale of ['en', 'it'] as const) {
      i18next.addResourceBundle(
        locale,
        'translation',
        {
          blocks: {
            [key]: {
              variants: Object.fromEntries(
                variants.map((variant) => [
                  variant.value,
                  variant.label[locale],
                ]),
              ),
            },
          },
        },
        // deep + overwrite, i18next's own params: layers over the core
        // block keys loaded at startup instead of clobbering them, so a
        // block keeps its own label and its core variants.
        true,
        true,
      );
    }
  }
}

export function themeBlockVariantsQueryOptions(themeName: string) {
  return queryOptions({
    queryKey: ['theme-block-variants', themeName] as const,
    queryFn: async () => {
      const response = await fetchThemeBlockVariants(themeName);
      registerVariantLabels(response);
      return response;
    },
    enabled: themeName !== '',
    staleTime: Infinity,
  });
}
