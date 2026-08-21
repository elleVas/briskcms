// Sibling of resolve-theme-block-override.ts, same reasoning — but for the
// "full PageLayout.astro override" escalation themes/README.md describes
// (a theme that wants to restructure header/main/footer wholesale, not
// just restyle blocks). A theme ships `~theme/PageLayout.astro` at its own
// root (next to theme.css/theme.json), not inside blocks/ — this is the
// whole page shell, not one block among many.
const themeLayoutOverride = import.meta.glob<{ default: unknown }>(
  '~theme/PageLayout.astro',
  { eager: true },
);

export function resolveThemeLayoutOverride<T>(coreLayout: T): T {
  const entry = Object.values(themeLayoutOverride)[0] as
    { default: T } | undefined;
  return entry?.default ?? coreLayout;
}
