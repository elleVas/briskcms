import type { BlockStyleDefaults } from '@brisk/shared-types';

/**
 * Isolato dal file che importa `~theme/theme.css?raw` (resolve-theme-
 * block-style-defaults.ts) per lo stesso motivo di render-block-fragment-
 * helpers.ts: la logica pura va testata a unità, l'import via alias Vite
 * no (richiede il plugin Astro che la config vitest di questo progetto
 * non registra).
 */

/**
 * Estrae le custom property dichiarate dentro `:root { ... }` di un
 * `theme.css` — non un parser CSS completo: ogni tema di questo progetto
 * dichiara un SOLO blocco `:root` piatto (nessun nesting, nessun
 * `@media`), vedi themes/classic/theme.css / themes/docs-showcase/
 * theme.css per la forma reale che questo regex copre.
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
 * Un'espressione dichiarata in `BlockDescriptor.defaultStyle` è o un
 * riferimento a UNA sola custom property del tema (`'var(--radius)'`,
 * mai annidato/composito — nessun blocco oggi usa `calc()`/più variabili
 * nello stesso default) o un letterale CSS (`'transparent'`, `'0.5rem'`)
 * che passa invariato: solo i riferimenti `var(--x)` dipendono dal tema
 * attivo, un letterale è già lo stesso per definizione in ogni tema.
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
