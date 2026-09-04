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
 * Calls apps/public-site directly (never apps/api) — the same reason as
 * renderBlockFragment (block-fragment-api-client.ts): it is the only app
 * that actually reads the themes' files (docs/adr/0021), so it does not go
 * through http-client.ts, whose base URL points at apps/api.
 *
 * Every function takes a `themeName` (docs/adr/0042): now that every theme
 * is bundled into the same image and the choice is per-site
 * (`Site.themeName`), "current" no longer identifies anything on its own —
 * `?theme=` tells public-site WHICH theme to answer for.
 *
 * Not exported — a private collaborator of this module (security review
 * 2026-08-24: fetchThemeIcons and fetchBlockStyleDefaults used to live in
 * two separate files, each with the same fetch → check res.ok → throw →
 * schema.parse copied out).
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
