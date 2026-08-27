import { z } from 'zod';
import { blockSchema, seoMetaSchema } from './content-model.js';
import { publishedSiteSchema } from './published-site.js';

/** One entry per published locale-translation of this page (docs/adr/0017), including itself. */
export const publishedPageTranslationSchema = z.object({
  locale: z.string(),
  slug: z.string(),
});
export type PublishedPageTranslation = z.infer<
  typeof publishedPageTranslationSchema
>;

/** Root-to-parent order (does not include the page itself). Empty for a root-level page. */
export const publishedPageAncestorSchema = z.object({
  slug: z.string(),
  title: z.string(),
});
export type PublishedPageAncestor = z.infer<typeof publishedPageAncestorSchema>;

/**
 * The public, unauthenticated read shape (see apps/api's PublicPagesModule)
 * — only ever `publishedContent`, never a draft. Shared by
 * libs/application's getPublishedPageBySlug/getPreviewPageById (which build
 * it server-side) and apps/public-site's public-api-client.ts (which parses
 * it off the wire) — same reasoning as publishedSiteSchema.
 */
export const publishedPageSchema = z.object({
  content: z.array(blockSchema),
  seoMeta: seoMetaSchema,
  locale: z.string(),
  translations: z.array(publishedPageTranslationSchema),
  ancestors: z.array(publishedPageAncestorSchema),
  site: publishedSiteSchema,
  header: z.array(blockSchema).nullable(),
  footer: z.array(blockSchema).nullable(),
  headerSticky: z.boolean(),
});
export type PublishedPage = z.infer<typeof publishedPageSchema>;
