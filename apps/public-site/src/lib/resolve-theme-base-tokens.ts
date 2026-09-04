import type { ThemeBaseTokens } from '@brisk/shared-types';
import { parseRootCustomProperties } from './resolve-theme-block-style-defaults-helpers';
import { getThemeCssRaw, resolveBundledThemeName } from './theme-registry';

const cacheByTheme = new Map<string, ThemeBaseTokens>();

/**
 * The active theme's own base values for `--primary`/`--secondary`/
 * `--font-sans-value`/`--radius` — what GlobalStylesDialog (editor-app)
 * shows as the starting point before any Tier 1 site override exists, so
 * picking a theme and opening its style settings shows that theme's real
 * colors/font, not a generic hardcoded placeholder. Same
 * parseRootCustomProperties extraction as resolveThemeForegroundTokens,
 * memoized per theme (docs/adr/0042).
 */
export function resolveThemeBaseTokens(themeName: string): ThemeBaseTokens {
  const resolvedTheme = resolveBundledThemeName(themeName);
  const cached = cacheByTheme.get(resolvedTheme);
  if (cached) return cached;

  const themeVars = parseRootCustomProperties(getThemeCssRaw(resolvedTheme));
  const tokens: ThemeBaseTokens = {
    primary: themeVars.get('--primary') ?? '',
    secondary: themeVars.get('--secondary') ?? '',
    fontSansValue: themeVars.get('--font-sans-value') ?? '',
    radius: themeVars.get('--radius') ?? '',
  };
  cacheByTheme.set(resolvedTheme, tokens);
  return tokens;
}
