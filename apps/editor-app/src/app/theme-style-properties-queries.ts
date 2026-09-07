import { queryOptions } from '@tanstack/react-query';
import type { ThemeStylePropertiesResponse } from '@brisk/shared-types';
import i18next from '../i18n';
import { fetchThemeStyleProperties } from '../lib/theme-api-client';

/**
 * The style properties a theme adds to core block types (ADR-0047). Same
 * `staleTime: Infinity` posture as every other theme-* query, with
 * `themeName` in the key so switching theme refetches.
 *
 * Registers the labels into i18next on arrival, like
 * `themeBlockVariantsQueryOptions`: a theme cannot add keys to the
 * editor's bundles at build time, so its strings travel with the data.
 * They land under `blocks.<type>.styleProperties.<key>`, which is where
 * `BlockStyleFields` looks — a core property reads its label from its own
 * hardcoded map instead, and neither has to know about the other.
 */
function registerPropertyLabels(response: ThemeStylePropertiesResponse): void {
  for (const [blockType, properties] of Object.entries(response)) {
    const key = `${blockType.charAt(0).toLowerCase()}${blockType.slice(1)}`;
    for (const locale of ['en', 'it'] as const) {
      i18next.addResourceBundle(
        locale,
        'translation',
        {
          blocks: {
            [key]: {
              styleProperties: Object.fromEntries(
                properties.map((property) => [
                  property.key,
                  property.label[locale],
                ]),
              ),
            },
          },
        },
        true,
        true,
      );
    }
  }
}

export function themeStylePropertiesQueryOptions(themeName: string) {
  return queryOptions({
    queryKey: ['theme-style-properties', themeName] as const,
    queryFn: async () => {
      const response = await fetchThemeStyleProperties(themeName);
      registerPropertyLabels(response);
      return response;
    },
    enabled: themeName !== '',
    staleTime: Infinity,
  });
}
