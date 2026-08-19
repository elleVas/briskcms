import { z } from 'zod';

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
 */
export interface Block {
  type: string;
  props: Record<string, unknown>;
  children?: Block[];
}

export const blockSchema: z.ZodType<Block> = z.lazy(() =>
  z.object({
    type: z.string(),
    props: z.record(z.string(), z.unknown()),
    children: z.array(blockSchema).optional(),
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
 * Kept here rather than in `@brisk/puck-config` so apps/public-site can
 * import them without pulling in Puck/React at all (see docs/adr/0007 —
 * "any consumer of page content that isn't the editor... can walk children
 * directly without knowing anything about Puck"). `@brisk/puck-config`
 * imports these same schemas and wraps them in Puck's `ComponentConfig` for
 * the editor; this file is the single source of truth for each block's
 * shape either way.
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
 * than by string-matching a URL.
 */
export const pickedMediaSchema = z.object({
  mediaId: z.string(),
  url: z.string(),
});
export type PickedMedia = z.infer<typeof pickedMediaSchema>;

export const imagePropsSchema = z.object({
  media: pickedMediaSchema.nullable(),
  alt: z.string(),
  caption: z.string(),
});
export type ImageProps = z.infer<typeof imagePropsSchema>;

export const galleryPropsSchema = z.object({
  images: z.array(
    z.object({
      media: pickedMediaSchema.nullable(),
      alt: z.string(),
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
 * `locale`/`slug` are denormalized so a NavLink never needs a live lookup
 * to resolve where it points (same reasoning as PickedMedia's `url`) —
 * apps/public-site builds the href directly via localePath(locale, slug).
 * `title` is denormalized purely for the editor canvas/picker label (same
 * reasoning as PickedForm's `formName`), never used for rendering.
 */
export const pickedPageSchema = z.object({
  pageId: z.string(),
  locale: z.string(),
  slug: z.string(),
  title: z.string(),
});
export type PickedPage = z.infer<typeof pickedPageSchema>;

export const navLinkPropsSchema = navItemPositionSchema.extend({
  label: z.string(),
  linkType: z.enum(['page', 'url']),
  page: pickedPageSchema.nullable(),
  url: z.string(),
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

/** One CSS value per `ColumnsLayout`, shared between the Puck editor render (libs/puck-config) and the public Astro render (apps/public-site) so the two never drift apart. */
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

/** Reuses NavLink/PromoBar's `linkType`/`page`/`url` shape for the button's destination. `backgroundColor` is a free CSS color value (hex/named), same "editor is trusted to enter it correctly" trade-off as NavLink's `url` — no color-picker field exists yet in this codebase. */
export const bannerPropsSchema = z.object({
  title: z.string(),
  text: z.string(),
  buttonLabel: z.string(),
  linkType: z.enum(['page', 'url']),
  page: pickedPageSchema.nullable(),
  url: z.string(),
  backgroundColor: z.string(),
});
export type BannerProps = z.infer<typeof bannerPropsSchema>;

/** Standalone CTA button — same link shape as Banner/NavLink/PromoBar. `variant` picks between the two button styles Button.astro defines, nothing more elaborate than that. */
export const buttonPropsSchema = z.object({
  label: z.string(),
  linkType: z.enum(['page', 'url']),
  page: pickedPageSchema.nullable(),
  url: z.string(),
  variant: z.enum(['primary', 'secondary']).default('primary'),
});
export type ButtonProps = z.infer<typeof buttonPropsSchema>;

/**
 * `icon` is a plain free-text field (the editor pastes an emoji, e.g.
 * "🚀") rather than picking from an icon library — apps/public-site has no
 * icon dependency by design (docs/adr/0007 isolation), and adding one just
 * for this would be a new dependency, not a detail worth making on its own.
 */
export const featurePropsSchema = z.object({
  icon: z.string(),
  title: z.string(),
  text: z.string(),
});
export type FeatureProps = z.infer<typeof featurePropsSchema>;

/** Pure layout wrapper, no props of its own — same reasoning as `columnPropsSchema`. Its content lives entirely in `Block.children` (Feature only). */
export const featureGridPropsSchema = z.strictObject({});
export type FeatureGridProps = z.infer<typeof featureGridPropsSchema>;
