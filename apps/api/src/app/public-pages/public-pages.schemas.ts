import { z } from 'zod';
import { pageSlugSchema } from '../pages/pages.schemas.js';

// Rejects anything that isn't a plausible hostname before it ever reaches a
// query — a malformed Host header shouldn't get as far as the database.
const domainSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/,
    { message: 'domain must be a valid hostname' },
  );

export const publicPageBySlugQuerySchema = z.object({
  domain: domainSchema,
  slug: pageSlugSchema,
});
export type PublicPageBySlugQuery = z.infer<typeof publicPageBySlugQuerySchema>;

export const publicPagesSitemapQuerySchema = z.object({
  domain: domainSchema,
});
export type PublicPagesSitemapQuery = z.infer<
  typeof publicPagesSitemapQuerySchema
>;
