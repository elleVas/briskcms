import { z } from 'zod';
import {
  fieldValueOverlaySchema,
  pageContentSchema,
  seoMetaSchema,
} from '@brisk/shared-types';
import { pageSlugSchema } from './page-slug.schemas';

// Fase 4's pages-list view — every filter optional, an absent one just
// doesn't narrow the query (see DrizzlePageGroupRepository.listBySiteFiltered).
export const listPageGroupsQuerySchema = z.object({
  siteId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().min(1).optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  createdBy: z.string().uuid().optional(),
  locale: z.string().min(2).optional(),
});
export type ListPageGroupsQuery = z.infer<typeof listPageGroupsQuerySchema>;

export const createPageGroupBodySchema = z.object({
  siteId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  content: pageContentSchema.optional(),
});
export type CreatePageGroupBody = z.infer<typeof createPageGroupBodySchema>;

export const createPageGroupTranslationBodySchema = z.object({
  locale: z.string().min(2),
  slug: pageSlugSchema,
  seoMeta: seoMetaSchema,
});
export type CreatePageGroupTranslationBody = z.infer<
  typeof createPageGroupTranslationBodySchema
>;

export const savePageGroupContentBodySchema = z.object({
  content: pageContentSchema,
});
export type SavePageGroupContentBody = z.infer<
  typeof savePageGroupContentBodySchema
>;

export const savePageTranslationFieldValuesBodySchema = z.object({
  fieldValues: fieldValueOverlaySchema,
  parentGroupId: z.string().uuid().nullable(),
});
export type SavePageTranslationFieldValuesBody = z.infer<
  typeof savePageTranslationFieldValuesBodySchema
>;

export const saveDivergedPageTranslationContentBodySchema = z.object({
  content: pageContentSchema,
  parentGroupId: z.string().uuid().nullable(),
});
export type SaveDivergedPageTranslationContentBody = z.infer<
  typeof saveDivergedPageTranslationContentBodySchema
>;

export const updatePageTranslationSeoMetaBodySchema = z.object({
  seoMeta: seoMetaSchema,
  parentGroupId: z.string().uuid().nullable(),
});
export type UpdatePageTranslationSeoMetaBody = z.infer<
  typeof updatePageTranslationSeoMetaBodySchema
>;

export const rollbackPageGroupBodySchema = z.object({
  versionId: z.string().uuid(),
});
export type RollbackPageGroupBody = z.infer<typeof rollbackPageGroupBodySchema>;

export const reorderPageGroupsBodySchema = z.object({
  siteId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  orderedPageGroupIds: z.array(z.string().uuid()).min(1),
});
export type ReorderPageGroupsBody = z.infer<typeof reorderPageGroupsBodySchema>;
