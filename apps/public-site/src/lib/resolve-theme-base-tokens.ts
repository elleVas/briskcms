import themeCssRaw from '~theme/theme.css?raw';
import type { ThemeBaseTokens } from '@brisk/shared-types';
import { parseRootCustomProperties } from './resolve-theme-block-style-defaults-helpers';

let cached: ThemeBaseTokens | null = null;

/**
 * The active theme's own base values for `--primary`/`--secondary`/
 * `--font-sans-value`/`--radius` — what GlobalStylesDialog (editor-app)
 * shows as the starting point before any Tier 1 site override exists, so
 * picking a theme and opening its style settings shows that theme's real
 * colors/font, not a generic hardcoded placeholder. Same
 * parseRootCustomProperties extraction as resolveThemeForegroundTokens.
 */
export function resolveThemeBaseTokens(): ThemeBaseTokens {
  if (cached) return cached;
  const themeVars = parseRootCustomProperties(themeCssRaw);
  cached = {
    primary: themeVars.get('--primary') ?? '',
    secondary: themeVars.get('--secondary') ?? '',
    fontSansValue: themeVars.get('--font-sans-value') ?? '',
    radius: themeVars.get('--radius') ?? '',
  };
  return cached;
}
