import { z } from 'zod';
import { pagePathSchema } from '../pages/pages.schemas.js';

// Rejects anything that isn't a plausible hostname before it ever reaches a
// query — a malformed Host header shouldn't get as far as the database.
// Exported: sites.schemas.ts reuses this for a site's own `domain` field
// (see docs/adr/0016) — the identical validation, just checked at write
// time there instead of read time here.
export const domainSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/,
    { message: 'domain must be a valid hostname' },
  );

export const publicPageBySlugQuerySchema = z.object({
  domain: domainSchema,
  // Caller-supplied (from the URL's locale prefix, docs/adr/0017) rather
  // than always resolved to the site's own defaultLocale.
  locale: z.string().min(2),
  path: pagePathSchema,
});
export type PublicPageBySlugQuery = z.infer<typeof publicPageBySlugQuerySchema>;

export const publicPagesSitemapQuerySchema = z.object({
  domain: domainSchema,
});
export type PublicPagesSitemapQuery = z.infer<
  typeof publicPagesSitemapQuerySchema
>;

export const publicPagesSearchQuerySchema = z.object({
  domain: domainSchema,
  locale: z.string().min(2),
  // A whitespace-only query would reach plainto_tsquery as an effectively
  // empty tsquery — reject it here rather than let the adapter special-case it.
  q: z.string().trim().min(1),
});
export type PublicPagesSearchQuery = z.infer<
  typeof publicPagesSearchQuerySchema
>;

export const publicPagesChromeQuerySchema = z.object({
  domain: domainSchema,
  locale: z.string().min(2),
});
export type PublicPagesChromeQuery = z.infer<
  typeof publicPagesChromeQuerySchema
>;

export const publicPagesTreeQuerySchema = z.object({
  domain: domainSchema,
  locale: z.string().min(2),
});
export type PublicPagesTreeQuery = z.infer<typeof publicPagesTreeQuerySchema>;

export const publicPagePreviewQuerySchema = z.object({
  token: z.string().min(1),
});
export type PublicPagePreviewQuery = z.infer<
  typeof publicPagePreviewQuerySchema
>;
