import type { ThemeForegroundTokens } from '@brisk/shared-types';
import { parseRootCustomProperties } from './resolve-theme-block-style-defaults-helpers';
import { getThemeCssRaw, resolveBundledThemeName } from './theme-registry';

const cacheByTheme = new Map<string, ThemeForegroundTokens>();

/**
 * `--primary-foreground`/`--secondary-foreground` risolti (non `var(--x)`
 * grezzo) — non passa da `listBlockStyleDefaults()` (che risolve solo le
 * proprietà dichiarate in `BLOCK_STYLE_DEFAULTS` per tipo di blocco):
 * questi due token radice servono al controllo di contrasto WCAG
 * sull'editor (GlobalStylesDialog), indipendente da qualunque blocco.
 * Riusa `parseRootCustomProperties`, la stessa estrazione di
 * `:root { ... }` già usata lì — se un token manca dal tema attivo
 * (teoricamente possibile per un tema custom incompleto), il chiamante
 * riceve la stringa vuota e salta il controllo invece di lanciare.
 * Memoizzata per tema (docs/adr/0042).
 */
export function resolveThemeForegroundTokens(
  themeName: string,
): ThemeForegroundTokens {
  const resolvedTheme = resolveBundledThemeName(themeName);
  const cached = cacheByTheme.get(resolvedTheme);
  if (cached) return cached;

  const themeVars = parseRootCustomProperties(getThemeCssRaw(resolvedTheme));
  const tokens: ThemeForegroundTokens = {
    primaryForeground: themeVars.get('--primary-foreground') ?? '',
    secondaryForeground: themeVars.get('--secondary-foreground') ?? '',
  };
  cacheByTheme.set(resolvedTheme, tokens);
  return tokens;
}
