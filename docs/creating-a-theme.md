# Creating a Brisk theme

This is the practical guide: what you actually do, today, to turn a design
into a Brisk theme. For the reference — every file, every field, every
prop — see [themes/README.md](../themes/README.md). For why the design is
shaped this way, see [ADR-0021](adr/0021-site-theming-filesystem-packages-and-style-settings.md)
and [ADR-0043](adr/0043-theme-regions-and-the-publishable-theme-surface.md).

The short version: **a theme is a directory**. It does not have to live in
this repository, it does not need a `package.json`, and it can be as small
as two files.

## The escalation ladder

Reach for the lowest rung that gets you there. Each step up costs
something — more surface to keep working when Brisk changes — so most
themes should stop at the first one.

|     | You want to change                     | You write                                             |
| --- | -------------------------------------- | ----------------------------------------------------- |
| 1   | Colours, fonts, spacing, corners       | `theme.css` — design tokens                           |
| 2   | One block's markup                     | `blocks/<Name>.astro`                                 |
| 3   | The header, footer, or content wrapper | `regions/<Name>.astro`                                |
| 4   | Add a block type Brisk doesn't have    | `blocks/<Type>.block.ts` + `.astro` + `.locales.json` |

There is deliberately **no rung for "replace the whole page"**. There used
to be, and it was removed in ADR-0043 — the one theme that used it had to
copy 581 lines of page shell to change the one in the middle, and that copy
silently shipped four real defects. If a region cannot express what your
design needs, the contract gets extended; don't reach for `is:global` to
work around it.

## The smallest theme that works

Two files:

```
my-theme/
  theme.json    { "allowStyleOverrides": true }
  theme.css     :root { --primary: …; --background: …; --font-sans-value: …; }
```

Copy `themes/classic/theme.css` and rewrite the values. Every one of
Brisk's ~50 blocks is built on those tokens, the way shadcn/ui components
are — one implementation, restyled through custom properties, never
duplicated per theme.

Two tokens are easy to get wrong:

- **`--font-sans-value`**, not `--font-sans`. The indirection is what lets
  a site owner's own font picker override your default later. Set
  `--font-sans` directly and that picker silently stops working for your
  theme.
- Every colour token in the list `themes/README.md` gives. A missing one
  falls back to core's neutral default, which usually looks like a bug
  rather than a choice.

## Developing it outside this repo

Symlink your directory in and restart the dev server once:

```sh
ln -s /path/to/my-theme themes/my-theme
pnpm nx run @brisk/public-site:build && node apps/public-site/server.mjs
```

Then pick it in the editor's Style dialog ("Tema"), which writes
`Site.themeName`. Switching between themes after that needs nothing but a
page reload.

The restart matters: a brand-new directory under `themes/` is only picked
up when the eager globs re-evaluate at process start, not on a file save.
Edits to files inside an already-known theme hot-reload normally.

## Adding a webfont

Take the font as a real dependency and import it from a `fonts.css`:

```css
/* my-theme/fonts.css */
@import '@fontsource-variable/sora';
```

Then point `--font-sans-value` at it — **using the family name the package's
own `@font-face` declares, exactly**. `@fontsource-variable/sora` declares
`Sora Variable`, not `Sora`; a near-miss fails silently, falling through to
the next entry in your stack while the font you bundled never loads. Check
the built stylesheet's `@font-face` rule against your token.

**Never `<link>` to Google Fonts or any CDN.** It sends every visitor's IP
address to a third party — a German court ruled on exactly that in 2022 —
which is untenable for a product that sells "your data stays on your own
machine" and generates the customer's privacy policy for them; it also
breaks intranet deployments outright. Check you have redistribution rights
for the font: Google Fonts are OFL/Apache, a commercial licence usually is
not.

## Changing the page's furniture

Three optional files let you replace the element that _wraps_ part of the
page, without touching the page itself:

```astro
---
// my-theme/regions/Header.astro
import type { ThemeHeaderProps } from '@brisk/theme-runtime';
export type Props = ThemeHeaderProps;
const { sticky, class: className } = Astro.props;
---
<header class:list={['my-header', className, { 'my-header--sticky': sticky }]}>
  <slot />
</header>
```

You receive the already-rendered blocks as a slot and decide only the
wrapper. Core keeps `<html>`, `<head>`, `<body>`, the skip-to-content link,
the editor's `data-brisk-root-blocks` hooks, block rendering, CSP, cookie
consent, schema.org and the preview bridge — none of which a theme can
break.

**A region that forgets `<slot />` makes the entire page vanish, silently.**
Nothing warns you. It is the first thing to check if a page comes back
blank.

## What you import

Everything comes from packages, never from a relative path into
`apps/public-site`:

- `@brisk/theme-runtime` — the region props, `localePath`, the `Translator`
- `@brisk/shared-types` — every block's props type
- `@brisk/block-sdk` — `defineBlock`, field types, `CORE_BLOCK_TYPES`

Your `env.d.ts` needs exactly two lines:

```ts
/// <reference types="astro/client" />
/// <reference types="@brisk/theme-runtime/locals" />
```

The second one types `Astro.locals`, which is how you draw an icon your
theme wants (`Astro.locals.resolveIcon('globe', site.themeName)`). For an
icon the _editor's user_ picked on a block that has an icon field, don't
call that — core already resolved it and hands it to your override as
`iconSvg`.

## Shipping it

Your theme directory has to be present at `themes/<name>/` when the image
is built. **A symlink is not enough for a deployment** — Docker's `COPY`
preserves a symlink as a symlink, so the link dangles inside the image and
the theme is silently unreadable. Copy it, clone it, or add it as a git
submodule before `docker build`. Both images then pick it up on their own:
`apps/public-site` bundles the whole theme, and `apps/api` copies its
`theme.json` so it appears in the editor's theme picker.

If your theme lives in this repo, give it the Nx scaffolding too (copy
`themes/classic`'s `package.json`/`tsconfig*.json`/`eslint.config.mjs`/
`vitest.config.mts`, renaming the package) — that is what gives it real
`typecheck`/`lint`/`test` targets in CI. A theme in its own repository runs
its own.

## Before you call it done

1. **Look at it in a browser**, not just `astro check`. ADR-0021's
   Consequences record two real bugs — a CSS cascade surprise and a
   font-token naming trap — that only static checks missed.
2. **Look at a page with a second theme active too.** A rule that leaks is
   invisible on the theme you were designing. Anything global has to start
   from the `data-brisk-theme="<name>"` attribute core puts on `<html>`.
3. **Open the visual editor and insert a block into the header and the
   footer.** This is the exact thing the old full-shell override broke
   without anyone noticing.
4. **Check a page with no content** and a page with a lot of it.
