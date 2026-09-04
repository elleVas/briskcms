import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { IconEntry } from '@brisk/shared-types';
import { groupByTheme, resolveBundledThemeName } from './theme-registry';

// The same pattern as resolve-theme-block-override.ts and the former
// resolve-theme-layout-override.ts (docs/adr/0021/0042):
// `themes/<name>/icons/*.svg` resolved once per process for every bundled
// theme — a theme that declares no `icons` in theme.json simply has no
// entry in its own map, with no error.
const themeIconModules = import.meta.glob<string>(
  '../../../../themes/*/icons/*.svg',
  {
    eager: true,
    query: '?raw',
    import: 'default',
  },
);

function iconNameFromPath(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.svg$/, '');
}

const themeIconsByTheme = groupByTheme(
  themeIconModules,
  iconNameFromPath,
  (svg) => svg,
);

// The curated default set (docs/adr/0023): the whole current Lucide set,
// the same family editor-app already uses through lucide-react (see
// apps/editor-app/package.json) — not a hand-vendored subset, so it stays
// aligned with every version bump without a separate download/sync step.
// `lucide-static` is the only package in the Lucide family that publishes
// raw SVGs rather than React/Vue components — the only usable form here
// (apps/public-site has no server-side React runtime for core blocks,
// docs/adr/0019). Resolved through Node (`import.meta.resolve`), not
// `import.meta.glob`: a pattern pointing inside node_modules is not a
// relative path Vite's glob handles in this project, whereas Node's module
// resolution finds the package wherever pnpm actually symlinked it,
// regardless of the hoisting layout.
function loadDefaultIcons(): IconEntry[] {
  const packageJsonUrl = import.meta.resolve('lucide-static/package.json');
  const iconsDir = join(dirname(fileURLToPath(packageJsonUrl)), 'icons');
  return readdirSync(iconsDir)
    .filter((file) => file.endsWith('.svg'))
    .sort()
    .map((file) => ({
      name: file.replace(/\.svg$/, ''),
      svg: readFileSync(join(iconsDir, file), 'utf-8'),
    }));
}

let defaultIcons: IconEntry[] | null = null;

function getDefaultIcons(): IconEntry[] {
  if (!defaultIcons) defaultIcons = loadDefaultIcons();
  return defaultIcons;
}

/**
 * The active theme's whole icon set — a theme declaring even one icon WINS
 * outright over the default (no per-name fallback onto a partial set, see
 * docs/adr/0023's Consequences section): the "this theme does or does not
 * have its own set" choice is binary, not a merge.
 */
export function listThemeIcons(themeName: string): IconEntry[] {
  const themeIcons = themeIconsByTheme.get(resolveBundledThemeName(themeName));
  if (!themeIcons || themeIcons.size === 0) {
    return getDefaultIcons();
  }
  return [...themeIcons.entries()]
    .map(([name, svg]) => ({ name, svg }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const iconsByNamePerTheme = new Map<string, Map<string, string>>();

/** The per-name resolution block rendering uses (NavLink.astro, for instance) — it builds the map once per theme. */
export function resolveIconSvg(
  name: string | null | undefined,
  themeName: string,
): string | null {
  if (!name) return null;
  const resolvedTheme = resolveBundledThemeName(themeName);
  let iconsByName = iconsByNamePerTheme.get(resolvedTheme);
  if (!iconsByName) {
    iconsByName = new Map(
      listThemeIcons(resolvedTheme).map((icon) => [icon.name, icon.svg]),
    );
    iconsByNamePerTheme.set(resolvedTheme, iconsByName);
  }
  return iconsByName.get(name) ?? null;
}
