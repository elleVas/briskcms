import { z } from 'zod';
import {
  blockStyleOverrideSchema,
  type BlockStyleOverride,
} from './site-theme-tokens';

/**
 * Formato generico di un blocco di contenuto (output editor Puck, Fase 2).
 * Ogni tipo di blocco concreto (Hero, Testo, ...) definirà il proprio schema
 * per `props` — questo resta lo shape strutturale condiviso fino a quel momento.
 *
 * `children` è il nostro schema di nesting, indipendente dal formato nativo
 * di Puck (root/content/zones) — vedi docs/adr/0007. Il mapping layer in
 * editor-app converte le drop-zone di Puck in/da `children`, così restiamo
 * capaci di supportare blocchi "contenitore" senza accoppiare dominio e DB
 * al formato interno di una libreria terza.
 *
 * `id` è opzionale qui di proposito, in una finestra transitoria: il
 * backfill una tantum (vedi @brisk/shared-types' backfill-block-ids.ts)
 * assegna un id stabile ad ogni blocco esistente prima che qualunque nuovo
 * editor lo richieda. Reso obbligatorio solo nel deploy *successivo* al
 * backfill — mai prima, altrimenti un salvataggio dell'editor Puck ancora
 * attivo (che non scrive id) fallirebbe la validazione a metà rollout.
 */
export interface Block {
  id?: string;
  type: string;
  props: Record<string, unknown>;
  children?: Block[];
  /** Override per-istanza (docs/adr/0022) — solo QUESTO blocco, sopra l'eventuale override di tipo salvato nei themeTokens del sito. `undefined`/campi assenti = eredita normalmente. */
  styleOverride?: BlockStyleOverride;
}

export const blockSchema: z.ZodType<Block> = z.lazy(() =>
  z.object({
    id: z.string().optional(),
    type: z.string(),
    props: z.record(z.string(), z.unknown()),
    children: z.array(blockSchema).optional(),
    styleOverride: blockStyleOverrideSchema.optional(),
  }),
);

export const pageContentSchema = z.array(blockSchema);
export type PageContent = z.infer<typeof pageContentSchema>;

export const seoMetaSchema = z.object({
  title: z.string(),
  description: z.string(),
  ogTags: z.record(z.string(), z.string()).optional(),
  canonical: z.string().optional(),
});
export type SeoMeta = z.infer<typeof seoMetaSchema>;

/**
 * Per-block-type prop schemas, one per concrete block (Hero, Text, ...).
 * Kept here rather than in `@brisk/block-registry` so apps/public-site can
 * import them without pulling in React at all (see docs/adr/0007 — "any
 * consumer of page content that isn't the editor... can walk children
 * directly without knowing anything about the editor"). Both
 * `@brisk/block-registry`'s field descriptors and apps/public-site's
 * `BlockRenderer.astro` import these same schemas; this file is the single
 * source of truth for each block's shape either way.
 */
export const heroPropsSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
});
export type HeroProps = z.infer<typeof heroPropsSchema>;

export const textPropsSchema = z.object({
  body: z.string(),
});
export type TextProps = z.infer<typeof textPropsSchema>;

/**
 * The picked media's `url` is denormalized into the block props (not just
 * `mediaId`) so rendering — both the editor canvas and apps/public-site —
 * never needs a live call back to the media API to resolve an id to a URL.
 * `mediaId` is kept alongside it so the editor's media picker can still
 * highlight "this is the currently selected image" reliably, by id rather
 * than by string-matching a URL. `width`/`height` follow the same
 * reasoning (denormalized at pick-time, not re-resolved at render time) —
 * already measured by sharp at upload (see media.width/height,
 * local-disk-media-storage.adapter.ts/s3-media-storage.adapter.ts),
 * nullable only because media picked before this field existed has none.
 * Public-site's image-bearing blocks render them as real `width`/`height`
 * attributes to prevent layout shift (CLS) — omitted, not defaulted, when
 * absent, since a guessed value would be actively wrong. `.nullish()`, not
 * just `.nullable()`: every page saved before this field existed has
 * Image/Gallery/etc. blocks whose `media` object is missing the key
 * entirely, not holding `null` — a plain `.nullable()` would reject that
 * already-saved content outright the first time it's parsed.
 */
export const pickedMediaSchema = z.object({
  mediaId: z.string(),
  url: z.string(),
  width: z.number().nullish(),
  height: z.number().nullish(),
});
export type PickedMedia = z.infer<typeof pickedMediaSchema>;

export const imagePropsSchema = z.object({
  media: pickedMediaSchema.nullable(),
  alt: z.string(),
  // WCAG: a purely decorative image should have an empty alt on purpose,
  // not a filler string typed just to satisfy a "required" nudge in the
  // editor (InspectorPanel) — this flag is the deliberate-choice escape
  // hatch, authoritative at render time (Image.astro ignores `alt`
  // entirely when this is true, even if it's non-empty from before).
  isDecorative: z.boolean(),
  caption: z.string(),
});
export type ImageProps = z.infer<typeof imagePropsSchema>;

export const galleryPropsSchema = z.object({
  images: z.array(
    z.object({
      media: pickedMediaSchema.nullable(),
      alt: z.string(),
      isDecorative: z.boolean(),
    }),
  ),
});
export type GalleryProps = z.infer<typeof galleryPropsSchema>;

/**
 * `formName` is denormalized purely as the editor canvas label (docs/adr/0015)
 * — unlike `PickedMedia.url`, it is never used for rendering on the public
 * site, which live-fetches the form's current name/fields by `formId` on
 * every render instead of trusting this snapshot.
 */
export const pickedFormSchema = z.object({
  formId: z.string(),
  formName: z.string(),
});
export type PickedForm = z.infer<typeof pickedFormSchema>;

export const formBlockPropsSchema = z.object({
  form: pickedFormSchema.nullable(),
});
export type FormBlockProps = z.infer<typeof formBlockPropsSchema>;

/**
 * Shared by every site-chrome block that can be scoped to a breakpoint
 * (Nav, HamburgerMenu, NavLink, LanguageSwitcher) — apps/public-site maps
 * this to the `brisk-visibility-desktop-only`/`brisk-visibility-mobile-only`
 * utility classes (src/styles/visibility.css); `'always'` applies neither.
 * A bare enum, not a wrapper object with its own fixed default, because
 * the sensible default differs per block — each block's own schema below
 * picks its own `.default(...)`.
 */
export const visibilitySchema = z.enum([
  'always',
  'desktop-only',
  'mobile-only',
]);
export type Visibility = z.infer<typeof visibilitySchema>;

/**
 * Nav's only prop today is `visibility` (docs/adr/0018 follow-up,
 * 2026-08-19): defaults to `'always'` because that was its behavior
 * before this field existed (a horizontal row that just wraps on narrow
 * screens) — existing content keeps rendering identically. Its content
 * lives entirely in `Block.children` via a Puck slot field.
 *
 * There is no Header/Footer block anymore (docs/adr/0018 follow-up,
 * 2026-08-19): a site_layout_section's `content` for kind='header'/'footer'
 * IS directly the list of Nav/Text/Image blocks that belongs inside the
 * <header>/<footer> tag — apps/public-site (PR3) supplies that tag itself
 * around the rendered list, it is never a Block. This also means it's
 * structurally impossible to drop a "footer" into the header editor (or
 * vice versa): there is nothing named that to drop.
 */
export const navPropsSchema = z.object({
  visibility: visibilitySchema.default('always'),
});
export type NavProps = z.infer<typeof navPropsSchema>;

/**
 * Shared by every block that can land inside a Nav's flex row (NavLink,
 * LanguageSwitcher, and now HamburgerMenu): "left" leaves it in normal
 * flow, "right" applies a margin-left:auto push in nav.block.tsx's
 * render — the standard CSS trick for splitting a flex row without a
 * separate alignment control on the Nav container itself. Per-item, not
 * per-container, by explicit user request: the concrete case is "links
 * on the left, language switcher on the right, or vice versa" within the
 * same Nav.
 */
export const navItemPositionSchema = z.object({
  position: z.enum(['left', 'right']).default('left'),
});
export type NavItemPosition = z.infer<typeof navItemPositionSchema>;

/**
 * A distinct block from Nav, not a responsive behavior bolted onto it
 * (explicit user request, 2026-08-19): Nav is the desktop link row;
 * HamburgerMenu is a separately placed block with its own icon and its
 * own NavLink/LanguageSwitcher children, so an editor can give mobile
 * visitors different content than desktop (e.g. a "call us" link that
 * isn't in the desktop Nav at all) — not just a collapsed copy of the
 * same links. Renders as a toggle that reveals a dropdown panel directly
 * under itself (apps/public-site's HamburgerMenu.astro). Carries both
 * `navItemPositionSchema` (it can now be placed *inside* Nav's own row,
 * left or right of the links — nav.block.tsx's slot allows it) and its
 * own `visibility`, defaulting to `'mobile-only'`: that was its hardcoded
 * behavior before this field existed, kept as the default so a
 * HamburgerMenu placed before this change keeps behaving the same way.
 */
export const hamburgerMenuPropsSchema = navItemPositionSchema.extend({
  visibility: visibilitySchema.default('mobile-only'),
});
export type HamburgerMenuProps = z.infer<typeof hamburgerMenuPropsSchema>;

/** No other editor-time config: the real links depend on which page the visitor is looking at (site.enabledLocales/translations of THAT page), a runtime fact the editor canvas doesn't have — see LanguageSwitcher.astro. */
export const languageSwitcherPropsSchema = navItemPositionSchema.extend({
  visibility: visibilitySchema.default('always'),
});
export type LanguageSwitcherProps = z.infer<typeof languageSwitcherPropsSchema>;

/**
 * i18n a livello di campo (see the plan) — `pageGroupId` is locale-
 * independent by construction (a group, not one specific translation), on
 * purpose: `locale`/`slug` used to be denormalized here at PICK time, which
 * meant a link picked while editing one language pointed at THAT
 * language's path even when the containing block is shared across every
 * locale of the group (`page` isn't a `translatable` field — real bug,
 * found live: an IT reader could get an EN link). `locale`/`slug` are now
 * `.optional()` — present ONLY on a RESOLVED reference (added by
 * `resolvePageReferences` in page-reference.ts, at publish/preview render
 * time, for the locale actually being rendered), absent on the raw STORED
 * value the editor picker writes. `title` stays denormalized purely for
 * the editor canvas/picker label (same reasoning as PickedForm's
 * `formName`), never used for rendering either way.
 */
export const pickedPageSchema = z.object({
  pageGroupId: z.string(),
  title: z.string(),
  locale: z.string().optional(),
  slug: z.string().optional(),
});
export type PickedPage = z.infer<typeof pickedPageSchema>;

export const navLinkPropsSchema = navItemPositionSchema.extend({
  label: z.string(),
  linkType: z.enum(['page', 'url']),
  page: pickedPageSchema.nullable(),
  url: z.string(),
  /** Nome icona risolto contro il set del tema attivo (docs/adr/0023) — `null` = nessuna icona. `.default(null)`: i NavLink già salvati prima di questo campo non hanno la chiave. */
  icon: z.string().nullable().default(null),
  visibility: visibilitySchema.default('always'),
});
export type NavLinkProps = z.infer<typeof navLinkPropsSchema>;

/**
 * A dropdown trigger for a one-level submenu (Nav > NavDropdown > NavLink)
 * — deliberately not a link itself: combining "click opens the submenu"
 * and "click navigates" on the same element is the classic mega-menu UX
 * conflict, so `label` is just the toggle text, with no linkType/page/url
 * of its own (unlike NavLink). Deliberately capped at one level of
 * nesting (its own slot only allows NavLink, not another NavDropdown) —
 * arbitrarily deep mega menus are hard to use on touch devices, one
 * level covers the common case (e.g. "Prodotti" revealing a handful of
 * category links).
 */
export const navDropdownPropsSchema = navItemPositionSchema.extend({
  label: z.string(),
  visibility: visibilitySchema.default('always'),
});
export type NavDropdownProps = z.infer<typeof navDropdownPropsSchema>;

/**
 * A finite set of presets (not a free "number of columns" field) — every
 * layout maps to one explicit `grid-template-columns` value in
 * `columnsGridTemplate` below, in both the editor canvas and
 * apps/public-site. The editor doesn't enforce that a "2 uguali" Columns
 * block actually contains exactly 2 `Column` children (Puck slots don't
 * support that kind of cardinality check) — CSS Grid degrades gracefully
 * with fewer or more, same trade-off as every other radio-guided field in
 * this file (e.g. NavLink's `linkType`).
 */
export const columnsLayoutSchema = z.enum([
  'two-equal',
  'two-asymmetric',
  'three-equal',
]);
export type ColumnsLayout = z.infer<typeof columnsLayoutSchema>;

export const columnsPropsSchema = z.object({
  layout: columnsLayoutSchema.default('two-equal'),
});
export type ColumnsProps = z.infer<typeof columnsPropsSchema>;

/** One CSS value per `ColumnsLayout` — read by apps/public-site's Columns.astro, the only renderer (docs/adr/0007). */
export function columnsGridTemplate(layout: ColumnsLayout): string {
  switch (layout) {
    case 'two-equal':
      return '1fr 1fr';
    case 'two-asymmetric':
      return '3fr 7fr';
    case 'three-equal':
      return '1fr 1fr 1fr';
  }
}

/**
 * Pure layout wrapper, no props of its own — mirrors Nav's own reasoning
 * (see above) for why `strictObject`, not `object`. Its content lives
 * entirely in `Block.children`; which `ColumnsLayout` it renders under is
 * the parent `Columns` block's concern, not this block's own.
 */
export const columnPropsSchema = z.strictObject({});
export type ColumnProps = z.infer<typeof columnPropsSchema>;

/**
 * Generic grouping wrapper — the "Container/Sezione" from the original MVP
 * block list (piano-progetto-astro-cms.md) that never actually got built.
 * Unlike Column, its `children` slot is unrestricted (no `allow` list in
 * container.block.tsx): any block, including a nested Container or
 * Columns, can go inside. `background`/`padding` are theme-token-driven
 * (docs/adr/0021) — `primary`/`secondary` here follow the same convention
 * as everywhere else in the design system: primary is the CTA/accent
 * color (Button's own default `variant`, the global link color), muted/
 * secondary is supporting chrome (Card-like backgrounds, subtle
 * separation), never body copy or large surfaces on their own.
 */
export const containerBackgroundSchema = z.enum([
  'none',
  'muted',
  'primary',
  'secondary',
]);
export type ContainerBackground = z.infer<typeof containerBackgroundSchema>;

export const containerPaddingSchema = z.enum(['none', 'sm', 'md', 'lg']);
export type ContainerPadding = z.infer<typeof containerPaddingSchema>;

export const containerPropsSchema = z.object({
  background: containerBackgroundSchema.default('none'),
  padding: containerPaddingSchema.default('md'),
});
export type ContainerProps = z.infer<typeof containerPropsSchema>;

export const quotePropsSchema = z.object({
  quote: z.string(),
  author: z.string(),
  role: z.string(),
});
export type QuoteProps = z.infer<typeof quotePropsSchema>;

/**
 * `rating` is a plain 1-5 number, not a wrapper object — the Puck `number`
 * field enforces the range in the editor UI (min/max/step in
 * rating.block.tsx), so the schema only needs to describe the shape.
 */
export const ratingPropsSchema = z.object({
  rating: z.number().min(1).max(5),
  label: z.string(),
});
export type RatingProps = z.infer<typeof ratingPropsSchema>;

/**
 * Shared 5-point star SVG path — every star-rating render (Rating,
 * Testimonial) draws the same star, so the path itself lives here once
 * rather than being retyped per render target. apps/public-site's own
 * Astro components are the only renderer now (docs/adr/0007) — the editor
 * canvas shows that same real Astro output inside an iframe rather than a
 * separate React re-implementation.
 */
export const STAR_ICON_PATH =
  'M10 1.5l2.59 5.25 5.79.84-4.19 4.08.99 5.78L10 14.98l-5.18 2.47.99-5.78-4.19-4.08 5.79-.84L10 1.5z';

/**
 * `targetDate` is a free-form string (an ISO-ish datetime, e.g.
 * "2026-12-31T23:59"), not a branded/refined type — same trade-off as
 * NavLink's `url`: Puck has no native date-picker field, so this is a
 * plain text field in the editor and the public-site countdown
 * (Countdown.astro) parses it with `new Date(...)` at render time.
 */
export const countdownPropsSchema = z.object({
  targetDate: z.string(),
  label: z.string(),
});
export type CountdownProps = z.infer<typeof countdownPropsSchema>;

/**
 * `html` is sanitized before it ever reaches the DOM — confirmed with the
 * user (2026-08-19), overriding the initial "site owner writes it, skip
 * sanitization" assumption. apps/public-site's EmbedHtml.astro runs it
 * through sanitize-html with a permissive policy (script/iframe kept,
 * since that's the whole point of a free-embed block — YouTube/Calendly/
 * chat widgets are all script- or iframe-based — but any `on*` inline
 * event-handler attribute is stripped). The Puck editor canvas
 * (embed-html.block.tsx) never executes this HTML at all, even
 * sanitized — it only shows the raw code as escaped preview text.
 */
export const embedHtmlPropsSchema = z.object({
  html: z.string(),
});
export type EmbedHtmlProps = z.infer<typeof embedHtmlPropsSchema>;

export const codePropsSchema = z.object({
  code: z.string(),
  language: z.string(),
});
export type CodeProps = z.infer<typeof codePropsSchema>;

/**
 * `rows` is a plain matrix, first row always treated as the header
 * (`<thead>`) by both renders (table.block.tsx and Table.astro) — no
 * separate `headers` field or `hasHeader` toggle, keeping the shape as
 * simple as the hand-built "aggiungi riga/colonna" editor
 * (table-data-field.tsx) that produces it. Not required to stay
 * rectangular by the schema itself — a ragged matrix just renders a
 * ragged table (fewer `<td>`s on a short row), it can't crash the render,
 * so there is nothing to validate for at this boundary.
 */
export const tablePropsSchema = z.object({
  rows: z.array(z.array(z.string())),
});
export type TableProps = z.infer<typeof tablePropsSchema>;
/**
 * "Back to top" — no props beyond `visibility`. Its scroll-threshold
 * show/hide and smooth-scroll-to-top behavior live entirely in
 * apps/public-site's BackToTop.astro `<script>`, the same way
 * HamburgerMenu's open/close toggle has no prop of its own either — this
 * is display/interaction logic, not editor-configurable content.
 */
export const backToTopPropsSchema = z.object({
  visibility: visibilitySchema.default('always'),
});
export type BackToTopProps = z.infer<typeof backToTopPropsSchema>;

/**
 * Floating "chat on WhatsApp" button. `phoneNumber`/`message` build the
 * wa.me deep link directly in apps/public-site's WhatsAppButton.astro
 * (`https://wa.me/<phoneNumber>?text=<encodeURIComponent(message)>`) — no
 * format validation on `phoneNumber` here, same trade-off as NavLink's
 * `url`: the editor is trusted to enter it correctly.
 */
export const whatsAppButtonPropsSchema = z.object({
  phoneNumber: z.string(),
  message: z.string(),
  visibility: visibilitySchema.default('always'),
});
export type WhatsAppButtonProps = z.infer<typeof whatsAppButtonPropsSchema>;

/**
 * "Home > ancestor > ... > current page" trail. No `content` prop: the
 * actual chain comes from the published page's own `ancestors` (page
 * hierarchy, parentId) at render time, not from anything stored on the
 * block — same "editor canvas can't show real data" trade-off as
 * LanguageSwitcher. `homeLabel` is the only editor-configurable piece
 * (the link target itself is always the locale root, computed from
 * `locale` at render time, not stored here).
 */
export const breadcrumbPropsSchema = z.object({
  homeLabel: z.string().default('Home'),
  visibility: visibilitySchema.default('always'),
});
export type BreadcrumbProps = z.infer<typeof breadcrumbPropsSchema>;

/**
 * Dismissible announcement bar. Reuses NavLink's `linkType`/`page`/`url`
 * shape for its optional link, but not `navItemPositionSchema` — unlike
 * NavLink it never sits inside Nav's flex row, it's a standalone
 * full-width bar, so "left"/"right" has no meaning here. Dismissal is a
 * single fixed localStorage key ('brisk-promo-bar-dismissed',
 * apps/public-site's PromoBar.astro) with no per-message versioning: a
 * site owner who changes `message` after a visitor already dismissed the
 * old one won't have it reappear until that visitor clears localStorage —
 * an accepted limitation, not solved here.
 */
export const promoBarPropsSchema = z.object({
  message: z.string(),
  linkType: z.enum(['page', 'url']),
  page: pickedPageSchema.nullable(),
  url: z.string(),
  visibility: visibilitySchema.default('always'),
});
export type PromoBarProps = z.infer<typeof promoBarPropsSchema>;

/** A single question/answer pair — always a child of Accordion, rendered as `<details>/<summary>` (Accordion.astro), no JS needed for the open/close behavior itself. */
export const accordionItemPropsSchema = z.object({
  question: z.string(),
  answer: z.string(),
});
export type AccordionItemProps = z.infer<typeof accordionItemPropsSchema>;

/** Pure layout wrapper, no props of its own — same reasoning as `columnPropsSchema`. Its content lives entirely in `Block.children` (AccordionItem only). */
export const accordionPropsSchema = z.strictObject({});
export type AccordionProps = z.infer<typeof accordionPropsSchema>;

/** A single tab — its own `label` plus a nested slot of generic content (unlike AccordionItem, a tab panel can hold arbitrary blocks, not just text). Always a child of Tabs. */
export const tabPropsSchema = z.object({
  label: z.string(),
});
export type TabProps = z.infer<typeof tabPropsSchema>;

/** Pure layout wrapper, no props of its own — same reasoning as `columnPropsSchema`. Its content lives entirely in `Block.children` (Tab only). */
export const tabsPropsSchema = z.strictObject({});
export type TabsProps = z.infer<typeof tabsPropsSchema>;

/** Reuses NavLink/PromoBar's `linkType`/`page`/`url` shape for the button's destination. Per-instance color/spacing overrides live on `Block.styleOverride` (docs/adr/0022), not here — a block-agnostic mechanism, not a bespoke field per block. */
export const bannerPropsSchema = z.object({
  title: z.string(),
  text: z.string(),
  buttonLabel: z.string(),
  linkType: z.enum(['page', 'url']),
  page: pickedPageSchema.nullable(),
  url: z.string(),
});
export type BannerProps = z.infer<typeof bannerPropsSchema>;

/** Standalone CTA button — same link shape as Banner/NavLink/PromoBar. `variant` picks between the two button styles Button.astro defines. Per-instance color/spacing overrides live on `Block.styleOverride` (docs/adr/0022), not here. */
export const buttonPropsSchema = z.object({
  label: z.string(),
  linkType: z.enum(['page', 'url']),
  page: pickedPageSchema.nullable(),
  url: z.string(),
  variant: z.enum(['primary', 'secondary']).default('primary'),
});
export type ButtonProps = z.infer<typeof buttonPropsSchema>;

/**
 * Plain inline text link — same page/URL targeting as Button, deliberately
 * without a `variant`: a Link isn't a CTA, it renders as ordinary text
 * with the global link treatment (apps/public-site global.css), not a
 * button shape. For "a clickable word inside a sentence", not "a button
 * that happens to look like a link".
 */
export const linkPropsSchema = z.object({
  label: z.string(),
  linkType: z.enum(['page', 'url']),
  page: pickedPageSchema.nullable(),
  url: z.string(),
});
export type LinkProps = z.infer<typeof linkPropsSchema>;

/**
 * `icon` is a plain free-text field (the editor pastes an emoji, e.g.
 * "🚀") rather than picking from an icon library — apps/public-site has no
 * icon dependency by design (docs/adr/0007 isolation), and adding one just
 * for this would be a new dependency, not a detail worth making on its own.
 */
/** `icon` resolves against the active theme's icon set (docs/adr/0023), same nullable-name pattern as NavLink's own `icon` — `null` = no icon. */
export const featurePropsSchema = z.object({
  icon: z.string().nullable().default(null),
  title: z.string(),
  text: z.string(),
});
export type FeatureProps = z.infer<typeof featurePropsSchema>;

/** Pure layout wrapper, no props of its own — same reasoning as `columnPropsSchema`. Its content lives entirely in `Block.children` (Feature only). */
export const featureGridPropsSchema = z.strictObject({});
export type FeatureGridProps = z.infer<typeof featureGridPropsSchema>;

/**
 * A plain `<form method="get">` submitting to `/{locale}/search` (see
 * apps/public-site's search.astro) — no client-side fetch/dropdown, same
 * "prefer native mechanisms" reasoning already applied elsewhere
 * (NavDropdown's `<details>`, PromoBar's honeypot). `placeholder` is the
 * only editor-configurable text; the actual results page is not itself a
 * Block-composed page, it's a dedicated Astro route.
 */
export const searchBoxPropsSchema = z.object({
  placeholder: z.string().default('Cerca nel sito...'),
  visibility: visibilitySchema.default('always'),
});
export type SearchBoxProps = z.infer<typeof searchBoxPropsSchema>;

/**
 * "Solo embed (link YouTube/Vimeo), niente encoding/hosting video lato
 * nostro" (piano progetto, Blocchi editor MVP). `url` is parsed by
 * apps/public-site (parseVideoEmbedUrl) into a privacy-enhanced iframe src
 * — YouTube via youtube-nocookie.com; no such domain exists for Vimeo — and
 * gated behind a click on the public site (no third-party request/cookie
 * until the visitor explicitly asks for the video), same GDPR-conscious
 * pattern as `mapEmbedPropsSchema` below.
 */
export const videoEmbedPropsSchema = z.object({
  url: z.string(),
});
export type VideoEmbedProps = z.infer<typeof videoEmbedPropsSchema>;

/**
 * Google Maps by address, using the no-API-key `output=embed` query form
 * (not the paid Maps Embed API) — zero setup for a non-technical site
 * owner. Gated behind a click on the public site (no request to Google, no
 * cookie, until the visitor explicitly asks to see the map): Brisk has no
 * cookie-consent banner yet (batch H, not built), and click-to-load is a
 * complete, self-contained GDPR mitigation on its own, not a stopgap
 * waiting for that banner.
 */
export const mapEmbedPropsSchema = z.object({
  address: z.string(),
});
export type MapEmbedProps = z.infer<typeof mapEmbedPropsSchema>;

/**
 * Same `{ media, alt }[]` shape as `galleryPropsSchema`, on its own named
 * schema rather than reusing that const — same reasoning as
 * `columnPropsSchema`/`accordionPropsSchema`/`tabsPropsSchema` each having
 * their own name despite an identical `z.strictObject({})` shape. Rendered
 * as a swipeable/scroll-snap carousel (ImageSlider.astro) instead of a grid.
 */
export const imageSliderPropsSchema = z.object({
  images: z.array(
    z.object({
      media: pickedMediaSchema.nullable(),
      alt: z.string(),
      isDecorative: z.boolean(),
    }),
  ),
});
export type ImageSliderProps = z.infer<typeof imageSliderPropsSchema>;

/**
 * A reveal slider between two images of the same subject. `beforeLabel`/
 * `afterLabel` default to "Prima"/"Dopo" but stay editable — a renovation
 * before/after reads differently than e.g. a progress-photo before/after.
 */
export const beforeAfterPropsSchema = z.object({
  beforeImage: pickedMediaSchema.nullable(),
  afterImage: pickedMediaSchema.nullable(),
  beforeLabel: z.string().default('Prima'),
  afterLabel: z.string().default('Dopo'),
});
export type BeforeAfterProps = z.infer<typeof beforeAfterPropsSchema>;

/**
 * Same `{ media, alt }[]` shape as `galleryPropsSchema`/
 * `imageSliderPropsSchema` — rendered as a wrapping row, grayscale by
 * default with color-on-hover (LogoStrip.astro), the customary visual
 * treatment for an "as seen with" partner/client strip.
 */
export const logoStripPropsSchema = z.object({
  logos: z.array(
    z.object({
      media: pickedMediaSchema.nullable(),
      alt: z.string(),
      isDecorative: z.boolean(),
    }),
  ),
});
export type LogoStripProps = z.infer<typeof logoStripPropsSchema>;

/**
 * A single testimonial/review card — always a child of Testimonials,
 * rendered as one slide of a scroll-snap carousel (Testimonials.astro),
 * same "container + repeated child, single slot" pattern as
 * Feature/FeatureGrid. `rating` reuses the same 1-5 scale as
 * `ratingPropsSchema` but is its own field: a testimonial's star rating is
 * part of that testimonial, not a standalone Rating block placed beside it.
 */
export const testimonialPropsSchema = z.object({
  quote: z.string(),
  author: z.string(),
  role: z.string(),
  avatar: pickedMediaSchema.nullable(),
  rating: z.number().min(1).max(5),
});
export type TestimonialProps = z.infer<typeof testimonialPropsSchema>;

/** Pure layout wrapper, no props of its own — same reasoning as `columnPropsSchema`. Its content lives entirely in `Block.children` (Testimonial only). */
export const testimonialsPropsSchema = z.strictObject({});
export type TestimonialsProps = z.infer<typeof testimonialsPropsSchema>;

/** A single team member card — always a child of Team. */
export const teamMemberPropsSchema = z.object({
  name: z.string(),
  role: z.string(),
  bio: z.string(),
  photo: pickedMediaSchema.nullable(),
});
export type TeamMemberProps = z.infer<typeof teamMemberPropsSchema>;

/** Pure layout wrapper, no props of its own — same reasoning as `columnPropsSchema`. Its content lives entirely in `Block.children` (TeamMember only). */
export const teamPropsSchema = z.strictObject({});
export type TeamProps = z.infer<typeof teamPropsSchema>;

/**
 * A single pricing plan card — always a child of PricingTable. `price` is a
 * free-form string ("29€", "Su richiesta", ...), not a number — same
 * "editor is trusted to enter it correctly" trade-off as Banner's
 * `backgroundColor`, and a plain number can't represent "Gratis" or "Su
 * richiesta" anyway. `features` is a plain string list, one line per
 * feature — edited via FeatureListField (a textarea split on `\n`), the
 * same problem table-data-field.tsx solved for a 2D matrix, since Puck has
 * no native list-of-strings field. Reuses NavLink/Banner's
 * `linkType`/`page`/`url` shape for the CTA button's destination.
 */
export const pricingPlanPropsSchema = z.object({
  name: z.string(),
  price: z.string(),
  period: z.string(),
  features: z.array(z.string()),
  highlighted: z.boolean().default(false),
  buttonLabel: z.string(),
  linkType: z.enum(['page', 'url']),
  page: pickedPageSchema.nullable(),
  url: z.string(),
});
export type PricingPlanProps = z.infer<typeof pricingPlanPropsSchema>;

/** Pure layout wrapper, no props of its own — same reasoning as `columnPropsSchema`. Its content lives entirely in `Block.children` (PricingPlan only). */
export const pricingTablePropsSchema = z.strictObject({});
export type PricingTableProps = z.infer<typeof pricingTablePropsSchema>;

/**
 * A single animated counter — always a child of StatsCounter. `value` is
 * the target number counted up to; `prefix`/`suffix` are free text around
 * it (e.g. prefix "+", suffix "%" or "clienti"). The count-up animation
 * itself (IntersectionObserver + requestAnimationFrame, respecting
 * `prefers-reduced-motion`) lives entirely in apps/public-site's
 * StatsCounter.astro — same "editor canvas shows a static preview, the
 * public site owns the real interactivity" split as Countdown.
 */
export const statPropsSchema = z.object({
  value: z.number(),
  prefix: z.string(),
  suffix: z.string(),
  label: z.string(),
});
export type StatProps = z.infer<typeof statPropsSchema>;

/** Pure layout wrapper, no props of its own — same reasoning as `columnPropsSchema`. Its content lives entirely in `Block.children` (Stat only). */
export const statsCounterPropsSchema = z.strictObject({});
export type StatsCounterProps = z.infer<typeof statsCounterPropsSchema>;

/**
 * A single timeline step — always a child of Timeline. `label` is a short
 * marker (e.g. "Fase 1", "Gennaio 2026"), kept separate from `title`, the
 * same "eyebrow + heading" split PromoBar/Banner already use for their own
 * text hierarchy.
 */
export const timelineStepPropsSchema = z.object({
  label: z.string(),
  title: z.string(),
  description: z.string(),
});
export type TimelineStepProps = z.infer<typeof timelineStepPropsSchema>;

/** Pure layout wrapper, no props of its own — same reasoning as `columnPropsSchema`. Its content lives entirely in `Block.children` (TimelineStep only). */
export const timelinePropsSchema = z.strictObject({});
export type TimelineProps = z.infer<typeof timelinePropsSchema>;

/**
 * Standalone newsletter signup — deliberately decoupled from the Form
 * builder (docs/adr/0015): a single email field, its own render/submit
 * path (NewsletterSignup.astro + /api/newsletter/subscribe), no
 * `formId`/fields of its own and no FormSubmission row saved — the
 * subscribe call to NewsletterPort *is* the entire effect, there's no
 * separate "form data" to keep a historical record of. Same
 * honeypot+Turnstile anti-spam treatment as Form (it's the same kind of
 * unauthenticated public write endpoint).
 */
export const newsletterSignupPropsSchema = z.object({
  title: z.string(),
  buttonLabel: z.string(),
});
export type NewsletterSignupProps = z.infer<typeof newsletterSignupPropsSchema>;

/**
 * The worked example for `@brisk/block-sdk`'s `defineBlock()` (see
 * libs/block-sdk/README.md) — a real, first-party block like any other
 * above, not a special case. Its schema lives here for the same reason
 * every other block's does: `BlockRenderer.astro` needs the same schema
 * `defineBlock()` already validated `defaultProps` against, to validate
 * `block.props` again at render time.
 */
export const calloutPropsSchema = z.object({
  message: z.string(),
  tone: z.enum(['info', 'warning', 'success']),
});
export type CalloutProps = z.infer<typeof calloutPropsSchema>;
