# Brisk theme packages

This directory holds public-site's filesystem theme packages — Tier 2 of
the two-tier theming model in [docs/adr/0021](../docs/adr/0021-site-theming-filesystem-packages-and-style-settings.md).
Read that ADR for the _why_; this file is the _how_, for anyone building
a new theme (a Brisk core theme or an agency's own).

## What a theme is

A directory under `themes/`, selected for a deployment via the
`BRISK_THEME` env var (default `classic`), resolved by
`apps/public-site/astro.config.mjs` into a `~theme` Vite alias. Only
`apps/public-site` reads the filesystem directly — apps/api has no
concept of which theme is active, and editor-app never gets filesystem
access to a theme package either; it learns what a theme declares only
through the `GET /api/themes/current/*` routes apps/public-site serves
(icons, style defaults, and — since ADR-0041 — a theme's own extra
block types).

Also, since ADR-0041, every theme under here is a real Nx/pnpm package
(`@brisk/theme-<name>`, `nx.tags: ["app"]`) — it has its own
`package.json`/`tsconfig*.json`/`eslint.config.mjs`/`vitest.config.mts`
and real `typecheck`/`lint`/`test` targets that run in CI, not just when
it happens to be the active `BRISK_THEME` for a given build.

```
themes/<name>/
  theme.css      # required — design tokens
  theme.json      # required — manifest
  icons/*.svg      # optional — icon set (docs/adr/0023)
  PageLayout.astro   # optional — full layout override (not wired yet, see below)
  blocks/
    *.astro       # optional — full-file overrides of an existing core block
    *.block.ts     # optional — a genuinely NEW block type (ADR-0041), needs a matching .astro
    *.locales.json  # required alongside a .block.ts — that block's own i18n
```

## `theme.css` — the common case

Design tokens only, no markup. `apps/public-site/src/layouts/PageLayout.astro`
imports it after `../styles/global.css`, so a theme's `:root` values win
the cascade over that file's bare fallback defaults. Every block under
`apps/public-site/src/components/blocks` is meant to be restyled entirely
by swapping these tokens — the same way shadcn/ui components are themed:
one shared implementation, restyled via CSS custom properties, never
duplicated per theme.

Two things a theme's `theme.css` must define, both consumed by Tailwind
v4's `@theme inline` (see `themes/classic/theme.css` for the working
example):

- **Color tokens** — `--background`, `--foreground`, `--primary`,
  `--primary-foreground`, `--secondary`, `--secondary-foreground`,
  `--muted`, `--muted-foreground`, `--border`. Blocks use these via
  Tailwind utilities (`bg-primary`, `text-foreground`, …), never
  hardcoded hex values.
- **`--font-sans-value`** — the font stack. Referenced _indirectly_
  (`--font-sans: var(--font-sans-value)` inside `@theme inline`), not
  set directly as `--font-sans` — this indirection is what lets Tier 1's
  font override (docs/adr/0021) redefine just `--font-sans-value` later
  without fighting Tailwind's own token resolution. Get this wrong (set
  `--font-sans` directly) and Tier 1's font picker silently stops working
  for your theme — this bit Claude once during development, see
  `apps/public-site/src/layouts/PageLayout.astro`'s own comments for the
  full story on why every Tier 1 override is `!important`.

## `theme.json` — the manifest

```json
{ "allowStyleOverrides": true }
```

The one flag that exists today. `true` (or the file/field missing
entirely) means Tier 1's Style panel can override this theme's own
tokens on any site running it — this is the default, and what every core
theme ships with. Set it `false` to make the panel permanently inert for
this theme, on every site, regardless of what's saved in the database —
the mechanism an agency reaches for when they've built a bespoke theme
for a client and don't want the client's own panel edits (present or
future) to ever touch it. See docs/adr/0021's "Two-gate override
composition" section for the full reasoning, including why this can't be
a database-level toggle instead (a client-editable switch can't protect
the _agency's_ design intent from the client themselves).

## Going past tokens: full-file overrides

A theme that wants more than a restyle — a genuinely different `Hero`
layout, a custom Puck block — can ship its own `blocks/Hero.astro`; it
wins over core's own component, resolved at build time via the same
`~theme` alias mechanism. This is an escalation on top of the token-only
default, not the expected common case — most themes should need `theme.css`
and `theme.json` alone.

**Wired** (2026-08-21): `~theme/blocks/<Name>.astro` overrides the matching
core component, resolved via `import.meta.glob('~theme/blocks/*.astro')`
in `apps/public-site/src/lib/resolve-theme-block-override.ts`, called once
per block import in `BlockRenderer.astro` — a theme that ships nothing
there falls back to core with zero error (`import.meta.glob` against an
empty/missing directory just matches nothing). A full page-shell override
works the same way one level up: ship `~theme/PageLayout.astro` at the
theme's own root (next to `theme.css`/`theme.json`, not inside `blocks/`)
and it replaces `apps/public-site/src/layouts/PageLayout.astro` wholesale
— resolved in `resolve-theme-layout-override.ts`, wired into both of
PageLayout's two importers (`PublicPageContent.astro`,
`pages/[locale]/search.astro`). `classic` still ships neither — it only
ever needed tokens — so this remains unexercised by any real theme today,
but the resolution mechanism itself is no longer aspirational.

## Adding a genuinely new block type (ADR-0041)

A `blocks/<Type>.astro` with no matching `.block.ts` is an override, per
above — same type, different render. Adding a `.block.ts` next to it
(same basename) declares a brand-new block type instead, one core
doesn't know about at all: `blocks/Faq.block.ts` + `blocks/Faq.astro` +
`blocks/Faq.locales.json` together register a `Faq` block that shows up
in the editor's picker, under the category its descriptor declares,
translated, with zero edits to `libs/block-registry`,
`BlockRenderer.astro`, or `apps/editor-app`'s locale files. See
[libs/block-sdk/README.md](../libs/block-sdk/README.md#adding-a-block-from-a-theme-without-touching-core)
for the authoring contract itself (schema, descriptor, i18n key
convention) — this file only covers the theme-package side: your
theme's own `blocks/blocks.spec.ts` (copy `themes/docs-showcase/blocks/blocks.spec.ts`
if you're starting from `classic`, which ships none) is what actually
runs `validateThemeBlockSet()` against everything under `blocks/` in CI,
on every build. `themes/docs-showcase/blocks/StatusBadge.*` is a real,
live worked example if you want to trace one end to end.

## `icons/` — the icon set (docs/adr/0023)

Optional. One `.svg` file per icon, filename (minus extension) is the
icon's name — e.g. `icons/arrow-right.svg` registers `arrow-right`. A
theme that ships even one icon here uses **only** that set — no
per-missing-name fallback to the default set, this is a binary choice per
theme, not a merge (see ADR 0023's Consequences for why).

A theme that ships no `icons/` directory at all falls back to the full
current [Lucide](https://lucide.dev) icon set, resolved from the
`lucide-static` dependency in `apps/public-site/package.json` (raw SVG
files, same icon family already used for editor-app's own UI chrome via
`lucide-react`) — not a hand-picked/vendored subset, so it stays in sync
automatically whenever that dependency is bumped. See
`apps/public-site/src/lib/resolve-theme-icons.ts`.

editor-app's icon picker never reads this directory directly (it can't —
separate app, no filesystem access to a theme package at runtime); it
fetches the resolved manifest from `GET /api/themes/current/icons`
instead.

## The boundary you can't cross

A theme can restyle or rewrite anything in the rendering layer, and
(since ADR-0041) add genuinely new block types of its own. What it still
cannot do is introduce a new _data field_ on an **existing** block type
— that requires extending that block's own Zod schema in
`libs/shared-types`, which is core, shared by every theme. A theme
renders the canonical `Block[]` content model (ADR-0007); it doesn't get
to redefine what an existing block's `props` shape contains, only add
block types with shapes of their own.

## Checklist for a new theme

1. Copy `themes/classic/` as a starting point — including its
   `package.json`/`tsconfig*.json`/`eslint.config.mjs`/`vitest.config.mts`
   (rename the package to `@brisk/theme-<name>`) and its
   `blocks/blocks.spec.ts`, even if you're not adding any `.block.ts`
   files yet (see ADR-0041) — it's what makes this theme's own files
   real, `nx run-many`-visible `typecheck`/`lint`/`test` targets.
2. `pnpm install` — new workspace packages need it to link.
3. Rewrite `theme.css`'s `:root` values — every token listed above,
   `--font-sans-value` included.
4. Decide `allowStyleOverrides` in `theme.json` — `true` unless you have
   a specific reason (see above) to lock it down.
5. Set `BRISK_THEME=<name>` and restart `apps/public-site`'s dev server —
   `astro.config.mjs` changes require a full restart, not just a file
   save (Vite doesn't hot-reload alias config).
6. Verify live in a browser, not just `astro check` — see docs/adr/0021's
   Consequences for two real bugs (a CSS cascade surprise and a font-token
   naming trap) that only static checks missed.
