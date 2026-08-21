import { z } from 'zod';

export const publicSiteLayoutSectionPreviewQuerySchema = z.object({
  token: z.string().min(1),
});
export type PublicSiteLayoutSectionPreviewQuery = z.infer<
  typeof publicSiteLayoutSectionPreviewQuerySchema
>;
