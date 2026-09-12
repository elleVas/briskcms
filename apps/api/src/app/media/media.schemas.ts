import { z } from 'zod';

export const listMediaQuerySchema = z.object({
  siteId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  /**
   * Part of a filename. The library is paginated, so this has to be
   * answered here and not by the caller filtering what came back — that
   * would be a search that only ever looked at the newest page.
   */
  search: z.string().trim().max(200).optional(),
  kind: z.enum(['image', 'video', 'audio']).optional(),
});
export type ListMediaQuery = z.infer<typeof listMediaQuerySchema>;

export const uploadMediaBodySchema = z.object({
  siteId: z.string().uuid(),
});
export type UploadMediaBody = z.infer<typeof uploadMediaBodySchema>;
