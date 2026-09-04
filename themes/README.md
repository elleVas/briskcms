# Brisk theme packages

This directory holds public-site's filesystem theme packages — Tier 2 of
the two-tier theming model in [docs/adr/0021](../docs/adr/0021-site-theming-filesystem-packages-and-style-settings.md).
Read that ADR for the _why_; this file is the _how_, for anyone building
a new theme (a Brisk core theme or an agency's own).

## What a theme is

A directory under `themes/`. Since docs/adr/0042, every theme here
bundles into the same `apps/public-site` image — which one a given
site actually renders with is `Site.themeName` (DB-backed), picked live
from editor-app's Style dialog, resolved fresh per request in
`apps/public-site/src/lib/theme-registry.ts` and every `resolve-theme-
*.ts` file built on it. There is no more single build-time `~theme`
alias to point at one theme. `BRISK_THEME` still exists, but its role
shrank to an optional, comma-separated allow-list read at **runtime** by
`theme-registry.ts` — it restricts which of the bundled themes a given
deployment will serve at all (an agency shipping an image whose client
can only ever pick the agency's own theme), not which one renders for a
given site. Every theme on disk always ends up bundled either way: a
glob pattern has to be a static literal, so it can't be narrowed by
config. Only
`apps/public-site` reads the filesystem directly — apps/api has no
concept of theme files, and editor-app never gets filesystem access to
a theme package either; it learns what a theme declares only through the
`GET /api/themes/current/*?theme=<name>` routes apps/public-site serves
(icons, style defaults, and — since ADR-0041 — a theme's own extra
block types).

Also, since ADR-0041, every theme under here is a real Nx/pnpm package
(`@brisk/theme-<name>`, `nx.tags: ["app"]`) — it has its own
`package.json`/`tsconfig*.json`/`eslint.config.mjs`/`vitest.config.mts`
and real `typecheck`/`lint`/`test` targets that run in CI, whether or
not any site currently renders with it.

```
themes/<name>/
  theme.css           # required — design tokens
  theme.json          # required — manifest
  fonts.css           # optional — self-hosted webfont, see below
  icons/*.svg         # optional — icon set (docs/adr/0023)
  regions/
    Header.astro      # optional — the element wrapping the header's blocks
    ContentShell.astro # optional — the element wrapping the page content
    Footer.astro      # optional — the element wrapping the footer's blocks
  blocks/
    *.astro           # optional — full-file overrides of an existing core block
    *.block.ts        # optional — a genuinely NEW block type (ADR-0041), needs a matching .astro
    *.locales.json    # required alongside a .block.ts — that block's own i18n
```

## `theme.css` — the common case

Design tokens only, no markup. `apps/public-site/src/layouts/PageLayout.astro`
reads this file's `:root` block per request (via `theme-registry.ts`'s
`getThemeCssRaw`) and re-emits it as an inline `<style>` with every
declaration marked `!important`, so a theme's values win over
`../styles/global.css`'s bare fallback defaults regardless of the order
Astro happens to inject that stylesheet — see docs/adr/0042 and
PageLayout.astro's own comments for why a plain `import './theme.css'`
can't do this anymore now that the theme is chosen per request rather
than per build. Every block under
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
{ "allowStyleOverrides": true, "stickyFooter": false }
```

**`allowStyleOverrides`** — `true` (or the file/field missing
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

**`stickyFooter`** — `true` pins the footer to the bottom of the viewport
on pages too short to fill it. It is a manifest flag rather than something
you write in your own CSS because it targets `<body>`, which core owns: a
theme can only reach `<body>` through `<style is:global>`, and a global
rule from one theme lands on **every other theme's** pages too (that is a
real bug this directory shipped, not a hypothetical). Declared here, core
applies it with its own scoped style and nothing leaks.

## Going past tokens: block overrides

A theme that wants more than a restyle — a genuinely different `Hero`
layout, a custom block — can ship its own `blocks/Hero.astro`; it wins
over core's own component for any site running that theme. This is an
escalation on top of the token-only default, not the expected common
case — most themes should need `theme.css` and `theme.json` alone.

**Wired** (2026-08-21, made per-theme by docs/adr/0042):
`blocks/<Name>.astro` overrides the matching core component. Every
bundled theme's overrides are globbed together once
(`import.meta.glob('.../themes/*/blocks/*.astro')` in
`apps/public-site/src/lib/resolve-theme-block-override.ts`) and looked up
by `(themeName, blockType)` per render, from `BlockRenderer.astro`'s own
`site.themeName` — a theme that ships nothing there falls back to core
with zero error (a glob matching nothing is just an empty map, and an
unknown theme name falls back to a bundled one rather than rendering
blank). The next level up — the furniture _around_ the blocks — is not
another override but the narrower `regions/` contract described in the
following section. `classic` ships neither, needing only tokens.

## `regions/` — changing the page's own furniture

Tokens restyle the blocks; `blocks/*.astro` rewrites one of them. What is
left is the furniture _around_ them — the `<header>` element itself, the
column layout the content sits in, the `<footer>`. A theme supplies any of
three optional files for that:

| File                         | Replaces                                                    | Extra prop        |
| ---------------------------- | ----------------------------------------------------------- | ----------------- |
| `regions/Header.astro`       | core's `<header>` wrapper                                   | `sticky: boolean` |
| `regions/ContentShell.astro` | core's content wrapper (which is nothing at all by default) | —                 |
| `regions/Footer.astro`       | core's `<footer>` wrapper                                   | —                 |

Supply none and you get core's own, byte for byte as today. Supply one and
you decide only the wrapping element and its classes — **you receive the
already-rendered blocks as a slot**:

```astro
---
import type { ThemeHeaderProps } from '../../../apps/public-site/src/lib/theme-regions';
export type Props = ThemeHeaderProps;
const { sticky, class: className } = Astro.props;
---
<header class:list={['my-header', className, { 'my-header--sticky': sticky }]}>
  <slot />
</header>
```

**A region that forgets `<slot />` makes the entire page vanish, silently.**
Nothing warns you — not `astro check`, not the build. It is the first thing
to check if a page comes back blank.

### Why it is a slot and not a copy

Until 2026-09-04 a theme could instead ship a `PageLayout.astro` at its own
root that replaced core's layout wholesale. That is **removed**, not
deprecated. It looked cheaper and was not: `docs-showcase` had to copy 581
lines of shell in order to change the one in the middle, and the copy then
drifted in silence, shipping four real defects nobody caught — the WCAG
2.4.1 skip link disappeared, the `data-brisk-root-blocks` attributes went
with it (so inserting a block into the header or footer from the visual
editor was simply broken on that theme), the theme's `theme.css` leaked its
whole dark palette onto **every other theme's** pages, and the copy never
received a token-injection fix core had made in the meantime.

So the list of what stays core's is the point of the design, not a
limitation to work around: all of `<html>`/`<head>`/`<body>`, the skip
link, `data-brisk-root-blocks`, block rendering, CSP nonces, cookie
consent, schema.org and the editor's preview bridge. If a region cannot
express what your design needs, the contract gets extended — don't reach
for `is:global` to get around it.

### The props

Every region receives `ThemeRegionProps` (see
`apps/public-site/src/lib/theme-regions.ts`, which is the authority):

- **`locale`**, **`currentPath`** (`Astro.url.pathname`, no trailing slash)
  and **`i18n`** (core's translator, already bound to `locale`).
- **`route`** — `'page' | 'search' | 'error'`. Regions are never rendered
  on the 500 page at all: that page is the last error handler, and a throw
  there has nowhere left to propagate.
- **`editable`** — true only inside the editor's preview iframe.
- **`pageTree()`** — an async accessor for the site's published page tree.
  Call it only if you need it: core owns the fetch, memoizes it **per
  request** (pages get published between requests), guards on the site's
  domain and resolves to `[]` on failure rather than throwing. This one
  prop is most of what the old copies got wrong.
- **`class`** — Astro injects this because core's layout has `<style>`
  blocks of its own. Forward it onto your root element to let core's scoped
  styles reach it, or ignore it deliberately.

`Site.themeName` is _not_ passed, and neither is `PublishedSite`: it would
carry `headScript`, `trackerScripts` and `cookieBannerSettings` along with
it — an invitation to reimplement exactly the infrastructure this design
takes off your hands.

### Styling a region

Write ordinary scoped `<style>` in the region file. One rule to internalise,
because it has bitten this codebase twice: **Astro's scoping follows the
file the element is written in.** A rule for `<header>` only matches if it
lives in the same file that writes the `<header>` tag. A selector aimed at
something core renders (the `<footer>`, a block's root) needs
`:global(...)` on that part — keep the left-hand side scoped so the rule
still cannot escape onto another theme.

For genuinely global CSS the sanctioned hook is the
`data-brisk-theme="<name>"` attribute core puts on `<html>`: start every
global selector from there and your rules cannot reach a page rendered with
a different theme.

## `fonts.css` — a self-hosted webfont

Optional, and the only supported way to ship a font. Take the font as a real
dependency in your theme's `package.json` and import it:

```css
/* themes/<name>/fonts.css */
@import '@fontsource-variable/sora';
```

Then point `--font-sans-value` at it in `theme.css` — using the family name
the package's own `@font-face` declares, **exactly**. `@fontsource-variable/sora`
declares `Sora Variable`, not `Sora`, and a near-miss fails silently: the
browser falls through to the next entry in the stack and the font you
bundled simply never loads. Check the built stylesheet's `@font-face` rule
against your token rather than trusting the package name. Vite rewrites the
`url()`s and bundles the font files, which a hand-written `@font-face` in
`theme.css` could never get (core only extracts that file's `:root` custom
properties, and the `url()` would never pass through the bundler).

**Never `<link>` to Google Fonts or any other CDN.** It sends every
visitor's IP address to a third party — a German court ruled on exactly
that in 2022 — which is untenable for a product that sells "your data stays
on your own machine" and generates the customer's privacy policy for them;
it also breaks any intranet deployment outright. Check you actually have
redistribution rights for the font: Google Fonts are OFL/Apache, a
commercial licence usually is not.

Every bundled theme's `fonts.css` ends up in the same stylesheet, which is
safe by construction rather than by luck: an `@font-face` that no rule
references downloads nothing. A theme wanting only system fonts ships no
`fonts.css` at all — see `themes/classic`.

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
instead. That route (like its four siblings) takes an optional
`?theme=<name>` since docs/adr/0042 — without it, it answers for a
fallback theme rather than erroring.

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
5. Only if tokens genuinely aren't enough: add a `regions/` file, a
   `blocks/*.astro` override, or a `fonts.css`. Each one is an escalation;
   a theme needing none of them is the expected case, and the cheapest one
   to keep working across upgrades.
6. Restart `apps/public-site`'s dev server once — a brand-new directory
   under `themes/` is only picked up when the eager globs re-evaluate at
   process start, not on a file save. After that, point a site at it by
   picking it in editor-app's Style dialog ("Tema"), which writes
   `Site.themeName`; switching between already-bundled themes needs
   nothing but a page reload (docs/adr/0042).
7. Verify live in a browser, not just `astro check` — see docs/adr/0021's
   Consequences for two real bugs (a CSS cascade surprise and a font-token
   naming trap) that only static checks missed. If you wrote a region,
   look at the page with a second theme active too: a rule that leaks is
   invisible on the theme you were designing.
