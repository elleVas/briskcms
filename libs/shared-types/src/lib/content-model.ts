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
 * Header/Nav/Footer have no props of their own today (docs/adr/0018) —
 * they're pure semantic wrappers, their content lives entirely in
 * `Block.children` via a Puck slot field. `strictObject` (not `object`,
 * and not `z.record`) so the inferred TS type is the literal empty type
 * `{}` — `z.object({})` infers with an implicit string index instead,
 * which breaks Puck's own mapped-type props (`{[K in keyof Props]: ...}`
 * collapses to `{[x: string]: never}`). A future prop (e.g. "sticky:
 * boolean" on Header) is still a typed change, not a silent `any`.
 */
export const headerPropsSchema = z.strictObject({});
export type HeaderProps = z.infer<typeof headerPropsSchema>;

export const navPropsSchema = z.strictObject({});
export type NavProps = z.infer<typeof navPropsSchema>;

export const footerPropsSchema = z.strictObject({});
export type FooterProps = z.infer<typeof footerPropsSchema>;

/** No config: the real links depend on which page the visitor is looking at (site.enabledLocales/translations of THAT page), a runtime fact the editor canvas doesn't have — see LanguageSwitcher.astro. */
export const languageSwitcherPropsSchema = z.strictObject({});
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

export const navLinkPropsSchema = z.object({
  label: z.string(),
  linkType: z.enum(['page', 'url']),
  page: pickedPageSchema.nullable(),
  url: z.string(),
});
export type NavLinkProps = z.infer<typeof navLinkPropsSchema>;
