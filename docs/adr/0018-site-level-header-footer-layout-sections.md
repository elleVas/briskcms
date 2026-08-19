# 0018 — Header/Nav/Footer as site-level layout sections

**Status**: Accepted — 2026-08-19

## Context

After Fase 5b (multilingua), `apps/public-site` still had no global chrome
at all: every page is pure block content (ADR-0007), so there was nowhere
to put a visible language switcher for real visitors — only search
engines could discover translations, via hreflang. Separately, the
product's own roadmap already flagged Header/Nav/Footer as the
highest-priority missing block: "today there is no way to navigate
between pages on the public site — that's a functional gap, not just a
cosmetic one."

Two decisions were made explicitly with the user before implementation:

## Decision

### Header/Footer live at site level, not as ordinary per-page blocks

One header and one footer per `(site, locale)`, configured once and
applied automatically to every page of that locale — not placed by hand
on each page like Hero/Text/Image. No WordPress-style multiple
"templates": that's complexity the product's target user (a non-technical
agency client running a 5-15 page showcase site) doesn't need. If a
future page ever needs to hide the header, a per-page toggle can be added
then — not built now without a real need.

### A dedicated domain entity, not `Page` with a discriminant

`SiteLayoutSection` mirrors `Page`'s lifecycle (draft/published content,
append-only version history) but drops `groupId`/`slug`/`seoMeta`:
Header/Footer have no public URL of their own, so they aren't pages in
any meaningful sense even though the shapes are similar. Considered reusing
`Page` with a `kind` discriminant instead — rejected in favor of a
dedicated entity, at the cost of duplicating the lifecycle machinery
(entity, DB table, ports, Postgres adapter, use-cases, API module) almost
1:1 against `Page`'s own.

### Real nested Puck blocks (slot fields), not a flat link array

Puck 0.23 supports `type: 'slot'` fields, producing a component-in-component
tree rather than a flat list — `Header` contains a `Nav` block, `Nav`
contains `NavLink`/`LanguageSwitcher` blocks. The domain's `Block.children`
(ADR-0007) already modeled this, unused until now.
`apps/editor-app/src/lib/puck-data-mapper.ts` now reads which fields are
slots directly off the `Config` passed in (`fromPuckData(data, config)` /
`toPuckData(blocks, config)`), rather than a separately maintained map —
one less place that could drift out of sync with a block's own definition.
`apps/public-site/src/components/BlockRenderer.astro` had to be
restructured: it previously rendered `block.children` as siblings after
the switch, not nested inside the parent element — fine for today's
leaf-only blocks, wrong for `<header>`/`<nav>`/`<footer>` wrappers.

### A dedicated Puck config, shared by Header and Footer

`headerFooterPuckConfig` (`libs/puck-config/src/lib/layout-config.ts`)
registers only `Header`, `Nav`, `NavLink`, `LanguageSwitcher`, `Footer`,
plus the existing `Text`/`Image` (reused as-is, not reimplemented) — a
structural guarantee (Puck's own component picker) that a non-technical
editor can't drag a Hero into the header by mistake, cheaper than a
runtime validation that would have to be maintained separately. One
config file, not two, since Header and Footer want the same restricted
palette (a mini nav-style footer is a legitimate, common pattern).

### A new locale's section starts as a copy of the default locale's

`getOrCreateSiteLayoutSection` — the first visit to the "Aspetto" editor
for a given `(site, locale, kind)` creates the row implicitly, since
Header/Footer have nothing to ask the user before creating them (unlike a
page, no slug/seoMeta to choose). If the site's default locale already
has a published section of that kind, the new draft starts as a copy of
its content — same "copy-on-translate" philosophy as
`createPageTranslation` (Fase 5b): enabling a language shouldn't force
rebuilding the header from scratch.

## Consequences

- New DB tables `site_layout_sections` / `site_layout_section_versions`
  (migrations `0011`/`0012`), same RLS pattern as every other tenant-scoped
  table.
- New library `@brisk/postgres-site-layout-section-repository`, new API
  module `apps/api/src/app/site-layout-sections/`.
- `getPublishedPageBySlug`'s `PublishedPage` grew `header`/`footer:
Block[] | null`, resolved in the same call (parallel query) rather than
  a separate public endpoint — same bundling reasoning as ADR-0016's
  `searchEngineIndexingEnabled`.
- No visible language switcher ships in this ADR either — it lives inside
  the `Nav` slot once an editor places it there, which still requires the
  editor-app UI and public-site rendering (tracked as in-progress, not yet
  done as of this ADR).
- `apps/editor-app`'s existing single Puck editor (pages) now has a
  sibling for Header/Footer, sharing a `BlockEditorShell` extracted for
  that reason rather than duplicating the fullscreen editor scaffold a
  third time.
