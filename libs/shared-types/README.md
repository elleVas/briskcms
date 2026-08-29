# shared-types

The wire-contract layer: Zod schemas (and the TypeScript types inferred
from them) for every value shape that crosses a trust boundary in this
codebase — the block/page content model, per-block-type props, the API
response DTOs (`PublishedPage`, `PublishedSite`, `PageRecord`,
`SiteRecord`, ...), and the editor/preview postMessage protocol. See
[ADR-0026](../../docs/adr/0026-shared-zod-schemas-for-api-response-shapes.md).
The only runtime dependency is `zod` itself — this package is intentionally
framework-free (no React, no NestJS, no Node built-ins in its main path)
so it can be imported unmodified from `apps/api` (Node/NestJS),
`apps/editor-app` (React/Vite), and `apps/public-site` (Astro, including
client-side `<script>`s bundled for the browser).

## Why schemas, not just types

Every DTO here is a Zod schema with an inferred type alongside it (`export
const fooSchema = z.object({...}); export type Foo = z.infer<typeof
fooSchema>`), not a plain `interface`. The schema is what actually gets
used at each network boundary — `apps/editor-app`'s and
`apps/public-site`'s HTTP clients parse the response body through the
schema instead of trusting a hand-copied TypeScript interface to stay in
sync with what `apps/api`'s controllers actually serialize. A drift
between server and client shape fails loudly (a parse error) instead of
producing a `undefined` deep in a component that assumed a field existed.

## The block content model (`content-model.ts`)

`Block` is the generic recursive shape every page/header/footer's content
is made of: `{ id?, type, props, children?, styleOverride? }`. `children`
is this codebase's own nesting mechanism, independent of any editor
library's native format (see
[ADR-0007](../../docs/adr/0007-nested-block-content-model-independent-of-puck.md))
— a mapping layer in `apps/editor-app` is what would translate to/from a
third-party editor's internal representation, not this schema itself.
`id` is optional at the type level for a specific reason: a one-time
backfill (`backfillBlockIds.ts`) assigns a stable id to every
already-persisted block before any editor that requires one ships — making
it required too early would break an in-flight save from an editor that
doesn't write ids yet.

This file also holds the **per-block-type `props` schema** for every one
of the ~48 registered block types (`heroPropsSchema`, `bannerPropsSchema`,
`navLinkPropsSchema`, ...) — deliberately _here_ and not in
`@brisk/block-registry`, even though that package is "the" block registry.
Two independent reasons converge on the same answer:

1. `apps/public-site`'s `BlockRenderer.astro` needs these shapes to
   validate/render content, and must not pull in React just to get a type
   (see ADR-0007's "any consumer of page content that isn't the editor...
   can walk children directly" principle).
2. In practice, making `apps/public-site` depend on `@brisk/block-registry`
   directly caused a real TypeScript resolution conflict between Astro's
   config and the registry's own React test files (see the history of
   `block-style-defaults.ts` for the incident) — `shared-types` has no such
   problem, since it's already a pure dependency of both apps.

Both `@brisk/block-registry` (editor field descriptors) and
`apps/public-site` (`BlockRenderer.astro`) import these same schema
constants — this file is the single source of truth for a block's shape
either way, even though the two packages consume it for different
purposes (editing vs. rendering).

Recurring patterns worth knowing when reading/extending these schemas:

- **Denormalization at pick-time**: a "picked" reference (`PickedMedia`,
  `PickedForm`, `PickedPage`) always carries the resolved display data
  (url, name, title) alongside the id, so rendering never needs a live
  lookup back to another API just to show a link/image/form. The id is
  kept anyway so the editor's picker can still highlight "this is
  currently selected" reliably.
- **`.nullish()` over `.nullable()` for legacy-optional fields**: e.g.
  `PickedMedia.width`/`height` — content saved before a field existed is
  missing the key entirely (not holding `null`), so a plain `.nullable()`
  would reject already-published pages the first time they're parsed.
- **`z.strictObject({})` for pure layout wrappers** (`Column`, `Tabs`,
  `Accordion`, `FeatureGrid`, ...) — no props of their own, all their
  content lives in `Block.children`.
- **`visibilitySchema`** (`'always' | 'desktop-only' | 'mobile-only'`) is
  reused by every breakpoint-scoped chrome block (Nav, HamburgerMenu,
  NavLink, LanguageSwitcher, ...); each block picks its own sensible
  `.default(...)` rather than sharing one fixed default.

## Site/theme/style schemas

- `site-theme-settings.ts` — Tier 1 of the two-tier theming model (see
  [ADR-0021](../../docs/adr/0021-site-theming-filesystem-packages-and-style-settings.md)):
  the live, DB-backed per-site overrides (colors, font, custom CSS/scripts,
  favicon) layered on top of whichever filesystem theme (Tier 2) is active.
- `site-theme-tokens.ts` / `block-style-overrides.ts` / `block-style-defaults.ts` —
  the "component and instance style overrides" system
  ([ADR-0022](../../docs/adr/0022-component-and-instance-style-overrides.md)):
  one generic `BlockStyleOverride` shape (backgroundColor, textColor,
  borderRadius, paddingX/Y, marginTop/Bottom) shared by every block type
  instead of a bespoke Zod field per block. `blockTypeToClassName` +
  `buildBlockStyleOverridesCss` turn a per-type override map into scoped
  CSS rules (`.brisk-hero { --brisk-override-bg: ... }`);
  `buildBlockInstanceStyle` does the equivalent for a single block
  instance's inline override. `marginTop`/`marginBottom` are deliberately
  excluded from the per-type CSS mechanism and only ever applied
  per-instance, at the root level of a page — see the comment on those two
  fields for why a per-type margin rule would leak into nested instances.
  `BLOCK_STYLE_DEFAULTS` is the single declared source of the CSS
  expression each block type falls back to when no override is set, read
  by both `@brisk/block-registry` (editor picker) and
  `apps/public-site`'s `resolve-theme-block-style-defaults.ts` (the
  `/api/themes/current/block-style-defaults` endpoint).
- `locale-settings.ts` — the default/enabled-locales + untranslated-page
  fallback policy (multilingua, [ADR-0017](../../docs/adr/0017-multilingua-locale-prefixed-urls-and-page-translations.md)),
  with a `.refine()` enforcing `defaultLocale` is one of `enabledLocales`.
- `business-info.ts` — schema.org `LocalBusiness` fields
  ([ADR-0014](../../docs/adr/0014-seo-metadata-editing-and-schema-org-scope.md)).
- `icons.ts` — the theme-provided icon manifest shape
  ([ADR-0023](../../docs/adr/0023-icon-system-theme-provided-manifest.md)).

## Form fields (`form-fields.ts`)

`FormField`/`FormFieldType` — the shared shape between the admin form
builder, the public renderer (which fetches a form's current fields live
at render time, [ADR-0015](../../docs/adr/0015-form-builder-architecture.md)),
and submission validation. A field's `stepId` is kept flat on the field
(not by nesting `fields` under `steps[]`) so a form with no steps defined
— every form that existed before multi-step support — needs zero migration
and renders exactly as before.

## Preview bridge protocol (`preview-bridge-protocol.ts`)

The `postMessage` envelope (`{ source, v, type, payload }`) between the
editor canvas (`apps/editor-app`, the parent window) and the real rendered
page inside its `<iframe>` (`apps/public-site`) — hover/click/drag,
inline-text-edit enter/exit, block insert/patch/remove/reorder, and live
style-override updates. `isPreviewBridgeMessage` is the type guard both
sides run before trusting `event.data`, since an iframe can receive
`postMessage` traffic from unrelated sources (browser extensions, other
scripts on the page) that must be silently ignored, not throw.

## Other utilities

- `slugify.ts` — used by both the editor (live slug preview while typing a
  page name) and the API (defense-in-depth: never trust a client-computed
  slug) so both sides derive the identical slug from the identical input.
- `page-hierarchy.ts` — `resolveAncestorSlugs`, a pure in-memory
  breadcrumb/ancestor-chain walk over an already-fetched page map (used by
  the sitemap use case; a single page's own ancestors elsewhere in the
  codebase are resolved via a small I/O loop instead, to avoid fetching an
  entire site's pages just to answer one page's ancestry).
- `search-text.ts` / `search-excerpt.ts` — `extractSearchableText` builds
  the indexable plain-text blob for a page (an explicit per-block-type
  prose-field allowlist, not a generic "grab every string prop", to avoid
  indexing urls/enum values/raw HTML as false-positive matches);
  `parseSearchExcerpt` turns Postgres `ts_headline`'s control-character
  match markers into `{ text, matched }` segments a UI can render safely
  without ever treating a search excerpt as trusted HTML.
- `backfill-block-ids.ts` — see the content-model section above; uses
  `globalThis.crypto.randomUUID()` (Web Crypto), not `node:crypto`,
  specifically because this function is reachable from a barrel export
  that `apps/public-site` also imports client-side — a `node:crypto` import
  would be externalized by Vite for the browser bundle and throw as soon as
  the barrel is evaluated, even if this particular function is never
  called there.

## Used by

All three apps: `apps/api`, `apps/editor-app`, and `apps/public-site` all
depend on `@brisk/shared-types` — it is the most widely-imported package in
this workspace (used across roughly 145 files under `apps/*/src`). It's
also a dependency of `@brisk/domain-core`, `@brisk/ports`, and
`@brisk/block-registry`.

## Running unit tests

Run `nx test shared-types` to execute the unit tests via [Vitest](https://vitest.dev/).
