# 0022 — Component-level and instance-level style overrides

**Status**: Accepted — 2026-08-22

## Context

ADR 0021 established two tiers: **Tier 1** (DB-backed site style settings —
colors, fonts, custom CSS/scripts, plus a `themeTokens` JSONB column
holding per-category token overrides, so far only one category:
`buttons`) and **Tier 2** (filesystem theme packages — `theme.css`
supplies every block's actual default values via Tailwind tokens). Both
tiers are **site-wide**: one value applies to every instance of a
concept, everywhere on the site.

Separately, three block descriptors (Button, Banner, PromoBar) expose a
`ColorPickerField` in the canvas toolbar — a **per-instance** override,
color only, editing that one block's own `props`.

The user asked directly for parity with mainstream page builders
(Webflow/Framer-style): select any block, either (a) restyle every
instance of that block **type** site-wide from one place, or (b) restyle
**this one instance** without touching any other. Today only (a) exists
for one type (buttons, via the Global Styles dialog, not the canvas), and
only (b) exists for three types (color only, via the canvas, not the
Style dialog). Neither surface generalizes to "any block type."

**Constraint found during design, and a wrong first answer caught before
shipping**: not every block has a stable CSS class to hang a type-level
override on — most follow the `brisk-{kebab-case-type}` convention
(`.brisk-button`, `.brisk-testimonial`, …), but some (`VideoEmbed`,
`MapEmbed`) render bare markup with none. The first version of this ADR
anchored the mechanism on `BlockRenderer.astro`'s
`data-brisk-block-type="…"` wrapper instead, reasoning it's stamped on
every block universally. That wrapper, however, **only exists when
`editable` is true** — `BlockRenderer.astro` renders it as a real `div`
for the editor canvas/preview route, but as a bare `Fragment` (no
element, no attributes at all) on the actual published site a real
visitor loads. A rule scoped to it would restyle blocks inside the editor
only and do nothing for anyone who actually visits the site — the
opposite of the point. Caught during implementation, before merging:
the mechanism instead derives the selector directly from the block's own
type name (`blockTypeToClassName` — "PromoBar" → "brisk-promo-bar"),
matching the class convention every stylable block already uses on its
own real, always-present markup — see Consequences for the one
mechanical requirement this puts on a block that opts in.

## Decision

### A third override layer, matching the CSS cascade's own mental model

1. **Theme default** (Tier 2, unchanged) — `theme.css`'s `:root` tokens.
2. **Component style override** (NEW — generalizes `themeTokens`) —
   site-wide, but scoped to one block **type**, not global. Stored as
   `themeTokens.blockStyles: Record<string, Partial<BlockStyleOverride>>`,
   replacing the old fixed `{ buttons: {...} }` shape. `BlockStyleOverride`
   is **one shared shape** (`backgroundColor`, `textColor`, `borderRadius`,
   `paddingX`, `paddingY`) reused by every block type — not a bespoke Zod
   field added per type, which doesn't scale past a handful of types.
   Edited from a new **"Stile" button in the canvas toolbar**
   (`BlockToolbarOverlay`) — select any block, click Stile, change values
   that apply to every instance of that type on the site. Emitted as:
   ```css
   .brisk-button {
     --brisk-override-bg: oklch(...);
   }
   ```
   one rule per styled type, in `PageLayout.astro`'s `<head>`, generalizing
   today's single `:root { --primary: ...; }` block. The selector is the
   block's own class (`blockTypeToClassName`, `apps/public-site/src/lib/
block-style-overrides.ts`), not an editor-only attribute — see the
   Context section above for why.
3. **Instance override** (NEW) — one specific block, stored on that
   block's own `Block.styleOverride` (same shared `BlockStyleOverride`
   shape, `Partial<>`, part of the page/header/footer content itself, not
   site settings). Rendered as an **inline `style` attribute directly on
   the block component's own real root element** — each participating
   block (Button.astro, Banner.astro, PromoBar.astro, …) accepts
   `styleOverride` as an extra prop from `BlockRenderer.astro`, alongside
   its normal content props, and applies it itself:
   ```html
   <a class="brisk-button" style="--brisk-override-bg: #ff0000;"></a>
   ```
   Not the `data-brisk-block-type` wrapper (same reason as above: it
   doesn't exist outside the editor). An inline declaration always wins
   the cascade for that one element over the type-level rule above — no
   `!important` war between layers 2 and 3, only layer 1→ layer 2 (Tier 1
   vs Tier 2, already `!important` per ADR 0021, unchanged).

Each block's own stylesheet reads through a three-level `var()` fallback
chain, e.g. Button.astro:

```css
.brisk-button {
  background: var(--brisk-override-bg, var(--primary));
  border-radius: var(--brisk-override-radius, var(--radius));
}
```

No new custom property namespace per layer — `--brisk-override-*` is the
same variable name at every layer; whichever is closest in the cascade
(inline > type-scoped selector > default fallback) wins, which is exactly
how CSS custom property resolution already works, not a mechanism this
ADR invents.

### Not every block gets every property — declared per block, incrementally

A block opts into which properties are stylable by declaring
`stylableProperties: (keyof BlockStyleOverride)[]` on its `BlockDescriptor`
(same pattern as `isContainer`/`allowedChildTypes`) — a Text block has no
sensible "border radius," a Button has all five. The "Stile" popover and
the instance popover both read this list to decide which fields to show
for the selected block, and only those blocks' own `.astro` files need
the `var()` fallback chain wired in for their declared properties.

**Rollout is incremental, not a mechanical pass over all 48 blocks in one
change**: the mechanism (schema, API, canvas UI, CSS emission) supports
any type from day one, but wiring the `var()` chain into each block's own
stylesheet — and deciding which properties actually make sense for it —
happens block by block, starting with Button/Banner/PromoBar (already
color-capable) plus a handful of high-value container-like blocks
(Container, Testimonial, PricingPlan). Coverage grows the same way
`themeTokens.buttons` itself started as the only category.

### Breaking schema change, not a compatibility shim

`themeTokens`'s shape changes from `{ buttons: {...} }` to
`{ blockStyles: { Button: {...}, ... } }` — a breaking change to the JSONB
shape, not a versioned migration. Justified because exactly one site
exists anywhere (dev DB), its `themeTokens` value is all-`null` fields
(never actually customized through the UI yet), and the product has no
real users yet (see the "quality bar" context this whole effort sits
inside) — there is nothing to preserve, so a clean break costs nothing
and avoids carrying a translation shim for a shape only one all-null row
ever had.

## Consequences

- `PATCH /sites/:id/theme-tokens` and its Zod schemas move from a fixed
  `buttons` field to the generic `blockStyles` map.
- `Block` (the shared content-model type, ADR 0007) gains an optional
  `styleOverride?: Partial<BlockStyleOverride>` field — a genuine, small
  extension of the canonical content model, not a per-theme escape hatch
  (ADR 0021's boundary: themes restyle, they don't redefine the content
  model — this field is core, available to every theme identically).
- `BlockToolbarOverlay` gains a "Stile" action alongside the existing
  per-instance color popover; the existing `ColorPickerField` on
  Button/Banner/PromoBar is superseded by the shared instance-override UI
  reading each block's `stylableProperties`.
- Not yet decided: whether `stylableProperties` ever needs anything
  beyond the five shared properties (e.g. a shadow, a border color) —
  deferred until a concrete block actually needs it, not designed
  speculatively now.
- A block that opts into `stylableProperties` must (a) have its own
  `.brisk-{kebab-case-type}` class on its real root element (rename/add
  one if it currently has none, e.g. `VideoEmbed`/`MapEmbed`) and (b)
  accept `styleOverride?: BlockStyleOverride` as a component prop and
  apply it via `buildBlockInstanceStyle` on that same root element —
  `BlockRenderer.astro` passes `styleOverride={block.styleOverride}` to
  every participating block, but the block itself owns rendering it,
  same as it owns reading its own content props.

## Follow-up (2026-08-24): resolved-default pre-fill, no schema change

Before this, the style popovers (toolbar and "Stile globale") showed an
empty field with a generic hint ("vuoto per il default") whenever nothing
was customized — the actual default value was invisible, because it only
ever lived as a hardcoded CSS fallback inside each block's own `.astro`
`<style>` block (often itself a reference to a theme token, e.g.
`var(--brisk-override-radius, var(--radius))`), never as data.

Considered (and rejected) making `theme_tokens.blockStyles` non-sparse —
seeding every block type with a real value at theme-creation time —
because it would need either a one-off migration script per theme (drifts
the moment a new block type ships without someone remembering to reseed)
or per-theme literal values that can't express "this default is itself a
reference to a theme token" (Hero's text color default isn't a fixed
color, it's `var(--foreground)` — different per theme).

**Decision**: no schema/database change. `BlockDescriptor` gains an
optional `defaultStyle: Partial<Record<keyof BlockStyleOverride,
string>>` (block-registry `field-types.ts`) — the same CSS expression
already hardcoded in the block's own fallback chain, now declared as
data, for every type that has `stylableProperties`. The actual values
live in `BLOCK_STYLE_DEFAULTS` (`libs/shared-types/src/lib/block-style-
defaults.ts`) rather than inline in block-registry — see that file's own
comment for why (a real TypeScript project-reference conflict between
Astro's checker and block-registry's React-testing spec files, hit when
`apps/public-site` briefly depended on `@brisk/block-registry` directly;
shared-types has no such problem and both apps already depend on it).

A new endpoint, `GET /api/themes/current/block-style-defaults`
(apps/public-site, same CORS/resolution pattern as docs/adr/0023's icon
endpoint), resolves each declared expression against the active theme's
real `theme.css` (`~theme/theme.css?raw`, parsed for its `:root` custom
properties) — a `var(--x)` reference resolves to the real value, a
literal (`'transparent'`, `'0.5rem'`) passes through unchanged. `theme_
tokens` itself stays exactly as before: one sparse JSONB column, only
customized properties stored — the "what does an untouched field look
like" question is answered by this live resolution, not by stored data.

editor-app fetches this once per session (`staleTime: Infinity`, the
active theme never changes at runtime) and threads it into
`BlockStyleFields`: a length field's placeholder becomes the resolved
value instead of a generic hint; `ColorPickerField` gained a
`defaultValue` prop showing a small CSS-native preview swatch (handles
non-hex values like `oklch(...)` that `<input type="color">` itself
can't display) plus the resolved value as the hex field's placeholder.
For the per-instance popover specifically, the effective pre-fill is
`typeStyle ?? themeDefault` (excluding explicit `null`s in `typeStyle`,
which mean "not customized at the type level either") — an instance
should preview what it's actually currently rendering, which is the
type-level override if one exists, not the theme's raw default.

Live-verified in a real browser: opening "Stile di tutti i blocchi Hero"
shows `Colore di sfondo` placeholder `Tema: transparent` and `Colore
testo` placeholder `Tema: oklch(0.145 0 0)` (Hero's real resolved
`var(--foreground)` value for the `classic` theme) — not blank.

Two real, pre-existing bugs found and fixed while touching this code
(both the same class: a loose-equality/strict-equality mix-up between
`null` and `undefined`, present because a sparse `BlockStyleOverride`
object can genuinely have a property missing — `undefined` — not just
explicitly `null`):

- `ColorPickerField`'s "torna al tema" (✕) button was gated on `value
!== null`; `undefined !== null` is `true` in JS, so it showed even for
  a never-customized field. Fixed to a truthy check.
- The same bug, same fix, in `IconPickerField` (docs/adr/0023) — found
  first there, during that feature's own live verification, which is
  what prompted checking `ColorPickerField` for the identical pattern.
