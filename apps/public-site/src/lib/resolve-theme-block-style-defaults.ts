import {
  BLOCK_STYLE_DEFAULTS,
  type BlockStyleDefaultsResponse,
} from '@brisk/shared-types';
import {
  parseRootCustomProperties,
  resolveBlockStyleDefaults,
} from './resolve-theme-block-style-defaults-helpers';
import { listThemePageBlocks } from './resolve-theme-page-blocks';
import { getThemeCssRaw, resolveBundledThemeName } from './theme-registry';

const cacheByTheme = new Map<string, BlockStyleDefaultsResponse>();

/**
 * Un'entry per ogni tipo di blocco dichiarato in
 * `BLOCK_STYLE_DEFAULTS` (shared-types — docs/adr/0022). Non legge
 * `@brisk/block-registry` direttamente: quel pacchetto è orientato ai
 * componenti React dell'editor (picker, dialog, contesti), e farlo
 * dipendere da apps/public-site ha causato un conflitto reale di
 * risoluzione TypeScript tra la configurazione di Astro e i file di test
 * React del registro — vedi la history di questo file. `BLOCK_STYLE_
 * DEFAULTS` in shared-types è la stessa identica sorgente di verità
 * (BlockDescriptor.defaultStyle la legge da lì anche lui), senza quel
 * problema. Calcolata una sola volta per tema (docs/adr/0042 — ogni tema
 * bundlato ha i propri token, memoizzata per tema una volta risolta).
 */
export function listBlockStyleDefaults(
  themeName: string,
): BlockStyleDefaultsResponse {
  const resolvedTheme = resolveBundledThemeName(themeName);
  const cached = cacheByTheme.get(resolvedTheme);
  if (cached) return cached;

  const themeVars = parseRootCustomProperties(getThemeCssRaw(resolvedTheme));
  const result: BlockStyleDefaultsResponse = {};
  for (const [type, declared] of Object.entries(BLOCK_STYLE_DEFAULTS)) {
    result[type] = resolveBlockStyleDefaults(declared, themeVars);
  }
  // Docs/adr/0041: a theme block's own `defaultStyle` (declared right in
  // its `.block.ts`, same shape as BLOCK_STYLE_DEFAULTS' own entries)
  // folds into this same response — `block-style-fields.tsx` already
  // looks up every block's resolved defaults generically by type string
  // against this one endpoint, core or theme-defined alike, so it needs
  // no changes of its own for a theme block's style popover to work.
  for (const entry of listThemePageBlocks([], resolvedTheme)) {
    if (entry.descriptor.defaultStyle) {
      result[entry.descriptor.type] = resolveBlockStyleDefaults(
        entry.descriptor.defaultStyle,
        themeVars,
      );
    }
  }
  cacheByTheme.set(resolvedTheme, result);
  return result;
}
