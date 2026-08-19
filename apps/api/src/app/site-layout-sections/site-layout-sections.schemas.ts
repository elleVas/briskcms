import { z } from 'zod';
import { pageContentSchema } from '@brisk/shared-types';

export const siteLayoutSectionKindSchema = z.enum(['header', 'footer']);

export const getOrCreateQuerySchema = z.object({
  siteId: z.string().uuid(),
  locale: z.string().min(2),
  kind: siteLayoutSectionKindSchema,
});
export type GetOrCreateQuery = z.infer<typeof getOrCreateQuerySchema>;

export const saveDraftBodySchema = z.object({
  content: pageContentSchema,
});
export type SaveDraftBody = z.infer<typeof saveDraftBodySchema>;

export const rollbackBodySchema = z.object({
  versionId: z.string().uuid(),
});
export type RollbackBody = z.infer<typeof rollbackBodySchema>;
