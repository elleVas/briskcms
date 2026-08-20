# Brisk theme packages

This directory holds public-site's filesystem theme packages — Tier 2 of
the two-tier theming model in [docs/adr/0021](../docs/adr/0021-site-theming-filesystem-packages-and-style-settings.md).
Read that ADR for the _why_; this file is the _how_, for anyone building
a new theme (a Brisk core theme or an agency's own).

## What a theme is

A directory under `themes/`, selected for a deployment via the
`BRISK_THEME` env var (default `classic`), resolved by
`apps/public-site/astro.config.mjs` into a `~theme` Vite alias. Nothing
outside `apps/public-site` reads this directory — editor-app and apps/api
have no concept of which theme is active.

```
themes/<name>/
  theme.css      # required — design tokens
  theme.json      # required — manifest
  blocks/*.astro    # optional — full-file block overrides
  PageLayout.astro   # optional — full layout override (not wired yet, see below)
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

**Not yet wired**: the actual per-block resolution (does `~theme/blocks/Hero.astro`
existing cause `apps/public-site` to import it instead of the core
component?) and a full `PageLayout.astro` override are described in the
ADR as available in principle but not yet built — `classic` is the only
theme that exists today, and it only needed tokens. Building this out is
future work, not something to assume already works.

## The boundary you can't cross

A theme can restyle or rewrite anything in the rendering layer. It
cannot introduce a new _data field_ on an existing block — that requires
extending the block's Zod schema in `libs/puck-config`, which is core,
shared by every theme. A theme renders the canonical `Block[]` content
model (ADR-0007); it doesn't get to redefine what that model contains.

## Checklist for a new theme

1. Copy `themes/classic/` as a starting point.
2. Rewrite `theme.css`'s `:root` values — every token listed above,
   `--font-sans-value` included.
3. Decide `allowStyleOverrides` in `theme.json` — `true` unless you have
   a specific reason (see above) to lock it down.
4. Set `BRISK_THEME=<name>` and restart `apps/public-site`'s dev server —
   `astro.config.mjs` changes require a full restart, not just a file
   save (Vite doesn't hot-reload alias config).
5. Verify live in a browser, not just `astro check` — see docs/adr/0021's
   Consequences for two real bugs (a CSS cascade surprise and a font-token
   naming trap) that only static checks missed.
