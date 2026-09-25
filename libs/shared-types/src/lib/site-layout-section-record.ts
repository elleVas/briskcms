import { z } from 'zod';
import { pageContentSchema } from './content-model';

/**
 * A site's header or footer (docs/adr/0018): which of the two a section is,
 * and where it is in its own draft/publish cycle. The one list each of the
 * domain, the wire and the database enums read.
 */
export const SITE_LAYOUT_SECTION_KINDS = ['header', 'footer'] as const;
export type SiteLayoutSectionKind = (typeof SITE_LAYOUT_SECTION_KINDS)[number];

/** Its own list, not a page's, even while the two hold the same words. */
export const SITE_LAYOUT_SECTION_STATUSES = ['draft', 'published'] as const;
export type SiteLayoutSectionStatus =
  (typeof SITE_LAYOUT_SECTION_STATUSES)[number];

/** A header or footer as every `/site-layout-sections` response carries it (docs/adr/0026). */
export const siteLayoutSectionRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  siteId: z.string(),
  locale: z.string(),
  kind: z.enum(SITE_LAYOUT_SECTION_KINDS),
  status: z.enum(SITE_LAYOUT_SECTION_STATUSES),
  content: pageContentSchema,
  publishedContent: pageContentSchema.nullable(),
  sticky: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SiteLayoutSectionRecord = z.infer<
  typeof siteLayoutSectionRecordSchema
>;

/** One saved state of a header or footer — `GET /site-layout-sections/:id/versions`. */
export const siteLayoutSectionVersionRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  siteLayoutSectionId: z.string(),
  content: pageContentSchema,
  createdBy: z.string().nullable(),
  createdAt: z.string(),
});
export type SiteLayoutSectionVersionRecord = z.infer<
  typeof siteLayoutSectionVersionRecordSchema
>;
