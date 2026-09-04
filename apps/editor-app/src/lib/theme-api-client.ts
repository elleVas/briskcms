import {
  blockStyleDefaultsResponseSchema,
  iconManifestSchema,
  themeBaseTokensSchema,
  themeBlocksResponseSchema,
  themeForegroundTokensSchema,
  type BlockStyleDefaultsResponse,
  type IconEntry,
  type ThemeBaseTokens,
  type ThemeBlocksResponse,
  type ThemeForegroundTokens,
} from '@brisk/shared-types';
import { PUBLIC_SITE_URL } from './public-site-url';

/**
 * Chiama apps/public-site direttamente (mai apps/api) — stesso motivo di
 * renderBlockFragment (block-fragment-api-client.ts): è l'unica app che
 * legge davvero i file dei temi (docs/adr/0021), non passa quindi da
 * http-client.ts, la cui base URL punta ad apps/api.
 *
 * Ogni funzione prende un `themeName` (docs/adr/0042): da quando ogni
 * tema è bundlato nella stessa immagine e la scelta è per-sito
 * (`Site.themeName`), "current" non identifica più niente da solo —
 * `?theme=` dice a public-site di QUALE tema rispondere.
 *
 * Non esportata — un collaboratore privato a questo modulo (security
 * review 2026-08-24: prima fetchThemeIcons/fetchBlockStyleDefaults
 * vivevano in due file separati, ognuno con lo stesso identico
 * fetch→check res.ok→throw→schema.parse ricopiato).
 */
class ThemeApiFetcher {
  async fetchAndParse<T>(
    path: string,
    themeName: string,
    schema: { parse: (data: unknown) => T },
  ): Promise<T> {
    const url = `${PUBLIC_SITE_URL}${path}?theme=${encodeURIComponent(themeName)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`${path} API error: ${res.status}`);
    }
    return schema.parse(await res.json());
  }
}

const themeApiFetcher = new ThemeApiFetcher();

export async function fetchThemeIcons(themeName: string): Promise<IconEntry[]> {
  return themeApiFetcher.fetchAndParse(
    '/api/themes/current/icons',
    themeName,
    iconManifestSchema,
  );
}

export async function fetchBlockStyleDefaults(
  themeName: string,
): Promise<BlockStyleDefaultsResponse> {
  return themeApiFetcher.fetchAndParse(
    '/api/themes/current/block-style-defaults',
    themeName,
    blockStyleDefaultsResponseSchema,
  );
}

export async function fetchThemeForegroundTokens(
  themeName: string,
): Promise<ThemeForegroundTokens> {
  return themeApiFetcher.fetchAndParse(
    '/api/themes/current/foreground-tokens',
    themeName,
    themeForegroundTokensSchema,
  );
}

export async function fetchThemeBaseTokens(
  themeName: string,
): Promise<ThemeBaseTokens> {
  return themeApiFetcher.fetchAndParse(
    '/api/themes/current/base-tokens',
    themeName,
    themeBaseTokensSchema,
  );
}

export async function fetchThemePageBlocks(
  themeName: string,
): Promise<ThemeBlocksResponse> {
  return themeApiFetcher.fetchAndParse(
    '/api/themes/current/blocks',
    themeName,
    themeBlocksResponseSchema,
  );
}
