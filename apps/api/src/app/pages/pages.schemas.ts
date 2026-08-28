import { z } from 'zod';
import { pageContentSchema, seoMetaSchema, slugify } from '@brisk/shared-types';

// Never trust a client-computed slug: re-derive it with the same slugify()
// the frontend uses for its live preview, and reject anything that isn't
// already in that canonical form — one source of truth for "valid slug"
// instead of a regex that could drift out of sync with slugify's rules.
export const pageSlugSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((slug) => slug === slugify(slug), {
    message: 'slug must be lowercase, alphanumeric, hyphen-separated',
  });

// A full URL path, root to leaf (e.g. "servizi/idraulica") — sibling-scoped
// slug uniqueness (schema.ts's `pages` unique constraints) means resolving
// a public page needs the whole path, not just the trailing slug alone
// (see resolvePageByPath). Each segment validated the same way a single
// slug is.
export const pagePathSchema = z
  .string()
  .min(1)
  .transform((path) => path.split('/').filter(Boolean))
  .refine(
    (segments) =>
      segments.length > 0 &&
      segments.every((segment) => segment === slugify(segment)),
    {
      message:
        'path segments must be lowercase, alphanumeric, hyphen-separated',
    },
  );

export const createPageBodySchema = z.object({
  siteId: z.string().uuid(),
  groupId: z.string().uuid(),
  locale: z.string().min(2),
  slug: pageSlugSchema,
  parentId: z.string().uuid().nullable().optional(),
  seoMeta: seoMetaSchema,
  content: pageContentSchema.optional(),
});
export type CreatePageBody = z.infer<typeof createPageBodySchema>;

export const setPageParentBodySchema = z.object({
  parentId: z.string().uuid().nullable(),
});
export type SetPageParentBody = z.infer<typeof setPageParentBodySchema>;

export const listPagesQuerySchema = z.object({
  siteId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListPagesQuery = z.infer<typeof listPagesQuerySchema>;

export const saveDraftBodySchema = z.object({
  content: pageContentSchema,
});
export type SaveDraftBody = z.infer<typeof saveDraftBodySchema>;

export const rollbackBodySchema = z.object({
  versionId: z.string().uuid(),
});
export type RollbackBody = z.infer<typeof rollbackBodySchema>;

export const updateSeoMetaBodySchema = z.object({
  seoMeta: seoMetaSchema,
});
export type UpdateSeoMetaBody = z.infer<typeof updateSeoMetaBodySchema>;

export const createTranslationBodySchema = z.object({
  locale: z.string().min(2),
  slug: pageSlugSchema,
});
export type CreateTranslationBody = z.infer<typeof createTranslationBodySchema>;

export const duplicatePageBodySchema = z.object({
  slug: pageSlugSchema,
  title: z.string().min(1),
  description: z.string(),
});
export type DuplicatePageBody = z.infer<typeof duplicatePageBodySchema>;
