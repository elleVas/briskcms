import { z } from 'zod';
import { seoMetaSchema } from './content-model';

/**
 * A value that exists once per language, keyed by locale — a term's name
 * in Italian and in English are the same concept said twice, not two
 * pieces of content.
 *
 * A map rather than a translation table (ADR-0064): a term has no draft,
 * no published snapshot, no structure and no version history, so the
 * machinery `page_translations` carries would all be dead weight. A
 * missing locale is not an error either; the caller falls back the way
 * every other locale-keyed value in this codebase does.
 */
export const localizedTextSchema = z.record(z.string(), z.string());
export type LocalizedText = z.infer<typeof localizedTextSchema>;

/** The same per-locale shape for the SEO block a term's route serves — `seoMetaSchema` is the one page translations already use, unchanged. */
export const localizedSeoMetaSchema = z.record(z.string(), seoMetaSchema);
export type LocalizedSeoMeta = z.infer<typeof localizedSeoMetaSchema>;

/**
 * One dimension a site classifies things along — "Category", "Family",
 * "Tag". Deliberately not tied to any entity: pages carry terms today
 * and products will carry the same terms later, on the same tables
 * (ADR-0064).
 */
export const taxonomySchema = z.object({
  id: z.string(),
  siteId: z.string(),
  /**
   * The URL prefix its terms live under (`/it/<slug>/<termSlug>`), or
   * `null` for terms that answer at the site root
   * (`/it/<termSlug>`) — the "pretty URL" case, which is also the one
   * that can collide with a root page's slug.
   */
  slug: z.string().nullable(),
  name: localizedTextSchema,
  /** Whether terms may nest. A flat dimension ("Tag") says false, and the editor then offers no parent. */
  hierarchical: z.boolean(),
  order: z.number().int(),
});
export type Taxonomy = z.infer<typeof taxonomySchema>;

/**
 * One value inside a dimension — "Espresso machines" inside "Category".
 *
 * `slugs` is separate from the rest for a database reason, not a
 * modelling one: a slug is what a URL is built from, and Postgres cannot
 * enforce "unique per locale" over a JSON map whose keys are whatever
 * languages the site happens to have. See ADR-0064.
 */
export const termSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  taxonomyId: z.string(),
  parentId: z.string().nullable(),
  name: localizedTextSchema,
  /** The introductory text the default term layout shows — not the meta description, which lives in `seoMeta`. */
  description: localizedTextSchema,
  seoMeta: localizedSeoMetaSchema,
  /**
   * A page built by hand that is rendered ON the term's own URL instead
   * of the default layout — never a redirect, so unlinking or deleting
   * it leaves the URL working (ADR-0064).
   */
  landingPageGroupId: z.string().nullable(),
  order: z.number().int(),
  /** locale -> the slug that term answers to in that language. */
  slugs: z.record(z.string(), z.string()),
});
export type Term = z.infer<typeof termSchema>;
