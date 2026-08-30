import themeCssRaw from '~theme/theme.css?raw';
import type { ThemeForegroundTokens } from '@brisk/shared-types';
import { parseRootCustomProperties } from './resolve-theme-block-style-defaults-helpers';

let cached: ThemeForegroundTokens | null = null;

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
 */
export function resolveThemeForegroundTokens(): ThemeForegroundTokens {
  if (cached) return cached;
  const themeVars = parseRootCustomProperties(themeCssRaw);
  cached = {
    primaryForeground: themeVars.get('--primary-foreground') ?? '',
    secondaryForeground: themeVars.get('--secondary-foreground') ?? '',
  };
  return cached;
}
