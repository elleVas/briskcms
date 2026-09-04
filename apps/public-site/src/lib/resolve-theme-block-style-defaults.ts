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
 * One entry per block type declared in `BLOCK_STYLE_DEFAULTS`
 * (shared-types — docs/adr/0022). It does not read `@brisk/block-registry`
 * directly: that package is oriented around the editor's React components
 * (picker, dialogs, contexts), and making apps/public-site depend on it
 * caused a real TypeScript resolution conflict between Astro's
 * configuration and the registry's own React test files — see this file's
 * history. `BLOCK_STYLE_DEFAULTS` in shared-types is the exact same source
 * of truth (BlockDescriptor.defaultStyle reads it from there too), without
 * that problem. Computed once per theme (docs/adr/0042 — every bundled
 * theme has its own tokens, memoized per theme once resolved).
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
