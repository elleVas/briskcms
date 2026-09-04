import {
  resolveBundledThemeName,
  themeNameFromGlobPath,
} from './theme-registry';

// Sibling of resolve-theme-block-override.ts, same reasoning — but for the
// "full PageLayout.astro override" escalation themes/README.md describes
// (a theme that wants to restructure header/main/footer wholesale, not
// just restyle blocks). A theme ships `themes/<name>/PageLayout.astro` at
// its own root (next to theme.css/theme.json), not inside blocks/ — this
// is the whole page shell, not one block among many.
const themeLayoutOverrideModules = import.meta.glob<{ default: unknown }>(
  '../../../../themes/*/PageLayout.astro',
  { eager: true },
);

const overrideByTheme = new Map<string, unknown>(
  Object.entries(themeLayoutOverrideModules)
    .map(([path, mod]) => [themeNameFromGlobPath(path), mod.default] as const)
    .filter((entry): entry is [string, unknown] => entry[0] !== null),
);

export function resolveThemeLayoutOverride<T>(
  coreLayout: T,
  themeName: string,
): T {
  const override = overrideByTheme.get(resolveBundledThemeName(themeName));
  return (override as T | undefined) ?? coreLayout;
}
