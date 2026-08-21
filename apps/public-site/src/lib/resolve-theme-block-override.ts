// docs/adr/0021 + themes/README.md's "escalation on top of the token-only
// default": a theme package can ship its own `blocks/<Name>.astro` to
// replace a core block's markup entirely, resolved at build time via the
// same `~theme` alias as theme.css. `import.meta.glob` against a directory
// that doesn't exist (most themes never need this) simply matches nothing
// — no error, `coreComponent` wins every time. One call per block import
// in BlockRenderer.astro, not a rewrite of its conditional-render logic.
const themeBlockOverrides = import.meta.glob<{ default: unknown }>(
  '~theme/blocks/*.astro',
  { eager: true },
);

export function resolveThemeBlockOverride<T>(
  blockType: string,
  coreComponent: T,
): T {
  // Matched by suffix, not a fixed key shape: import.meta.glob's key format
  // for an aliased pattern isn't part of Vite's stable public contract —
  // safer than assuming one exact string.
  const entry = Object.entries(themeBlockOverrides).find(([path]) =>
    path.endsWith(`/${blockType}.astro`),
  );
  const override = entry?.[1] as { default: T } | undefined;
  return override?.default ?? coreComponent;
}
