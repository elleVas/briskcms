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
 * conosce il tema attivo (`~theme`, docs/adr/0021), non passa quindi da
 * http-client.ts, la cui base URL punta ad apps/api.
 *
 * Non esportata — un collaboratore privato a questo modulo (security
 * review 2026-08-24: prima fetchThemeIcons/fetchBlockStyleDefaults
 * vivevano in due file separati, ognuno con lo stesso identico
 * fetch→check res.ok→throw→schema.parse ricopiato). Le due funzioni
 * pubbliche sotto restano quelle che erano, stesso nome, stesso comportamento.
 */
class ThemeApiFetcher {
  async fetchAndParse<T>(
    path: string,
    schema: { parse: (data: unknown) => T },
  ): Promise<T> {
    const res = await fetch(`${PUBLIC_SITE_URL}${path}`);
    if (!res.ok) {
      throw new Error(`${path} API error: ${res.status}`);
    }
    return schema.parse(await res.json());
  }
}

const themeApiFetcher = new ThemeApiFetcher();

export async function fetchThemeIcons(): Promise<IconEntry[]> {
  return themeApiFetcher.fetchAndParse(
    '/api/themes/current/icons',
    iconManifestSchema,
  );
}

export async function fetchBlockStyleDefaults(): Promise<BlockStyleDefaultsResponse> {
  return themeApiFetcher.fetchAndParse(
    '/api/themes/current/block-style-defaults',
    blockStyleDefaultsResponseSchema,
  );
}

export async function fetchThemeForegroundTokens(): Promise<ThemeForegroundTokens> {
  return themeApiFetcher.fetchAndParse(
    '/api/themes/current/foreground-tokens',
    themeForegroundTokensSchema,
  );
}

export async function fetchThemeBaseTokens(): Promise<ThemeBaseTokens> {
  return themeApiFetcher.fetchAndParse(
    '/api/themes/current/base-tokens',
    themeBaseTokensSchema,
  );
}

export async function fetchThemePageBlocks(): Promise<ThemeBlocksResponse> {
  return themeApiFetcher.fetchAndParse(
    '/api/themes/current/blocks',
    themeBlocksResponseSchema,
  );
}
