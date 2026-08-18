import { z } from 'zod';

export const listMediaQuerySchema = z.object({
  siteId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListMediaQuery = z.infer<typeof listMediaQuerySchema>;

export const uploadMediaBodySchema = z.object({
  siteId: z.string().uuid(),
});
export type UploadMediaBody = z.infer<typeof uploadMediaBodySchema>;
