import type { BlockStyleDefaults } from '@brisk/shared-types';

/**
 * Isolated from the file that imports `~theme/theme.css?raw`
 * (resolve-theme-block-style-defaults.ts) for the same reason as
 * render-block-fragment-helpers.ts: the pure logic should be unit-tested,
 * the Vite-aliased import should not (it needs the Astro plugin this
 * project's vitest config does not register).
 */

/**
 * Extracts the custom properties declared inside a `theme.css`'s
 * `:root { ... }` — not a full CSS parser: every theme in this project
 * declares a SINGLE flat `:root` block (no nesting, no `@media`), see
 * themes/classic/theme.css and themes/docs-showcase/theme.css for the real
 * shape this regex covers.
 */
export function parseRootCustomProperties(css: string): Map<string, string> {
  const map = new Map<string, string>();
  const rootMatch = css.match(/:root\s*{([^}]*)}/);
  if (!rootMatch) return map;
  for (const decl of rootMatch[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(`--${decl[1]}`, decl[2].trim());
  }
  return map;
}

/**
 * An expression declared in `BlockDescriptor.defaultStyle` is either a
 * reference to ONE theme custom property (`'var(--radius)'`, never nested
 * or composite — no block today uses `calc()` or several variables in the
 * same default) or a CSS literal (`'transparent'`, `'0.5rem'`) that passes
 * through unchanged: only `var(--x)` references depend on the active theme,
 * a literal being the same in every theme by definition.
 */
export function resolveDefaultStyleExpression(
  expression: string,
  themeVars: Map<string, string>,
): string {
  const match = expression.match(/^var\((--[\w-]+)\)$/);
  if (!match) return expression;
  return themeVars.get(match[1]) ?? expression;
}

export function resolveBlockStyleDefaults(
  declared: BlockStyleDefaults,
  themeVars: Map<string, string>,
): BlockStyleDefaults {
  const resolved: BlockStyleDefaults = {};
  for (const [key, expression] of Object.entries(declared)) {
    resolved[key as keyof BlockStyleDefaults] = resolveDefaultStyleExpression(
      expression,
      themeVars,
    );
  }
  return resolved;
}
