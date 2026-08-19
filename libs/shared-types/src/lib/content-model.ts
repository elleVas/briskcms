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
