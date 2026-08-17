import { z } from 'zod';
import { pageContentSchema, seoMetaSchema } from '@brisk/shared-types';

export const createPageBodySchema = z.object({
  siteId: z.string().uuid(),
  groupId: z.string().uuid(),
  locale: z.string().min(2),
  slug: z.string().min(1),
  seoMeta: seoMetaSchema,
  content: pageContentSchema.optional(),
});
export type CreatePageBody = z.infer<typeof createPageBodySchema>;

export const saveDraftBodySchema = z.object({
  content: pageContentSchema,
});
export type SaveDraftBody = z.infer<typeof saveDraftBodySchema>;

export const rollbackBodySchema = z.object({
  versionId: z.string().uuid(),
});
export type RollbackBody = z.infer<typeof rollbackBodySchema>;
