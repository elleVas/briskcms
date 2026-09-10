import { z } from 'zod';

/** `GET /collections` — a named section of the editor (News, Events, Case studies). */
export const collectionRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  siteId: z.string(),
  name: z.string(),
  /** A lucide icon name, so its sidebar entry looks like the ones the product ships with. */
  icon: z.string(),
  order: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CollectionRecord = z.infer<typeof collectionRecordSchema>;
