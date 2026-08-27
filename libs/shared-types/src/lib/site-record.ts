import { z } from 'zod';
import { businessInfoSchema } from './business-info.js';
import { untranslatedPageFallbackSchema } from './locale-settings.js';
import { hexColorSchema } from './site-theme-settings.js';
import { themeTokensSchema } from './site-theme-tokens.js';

/**
 * The full site record as the editor CRUD surface sees it (`GET /sites/:id`
 * and every `PATCH /sites/:id/*` response) — unlike `PublishedSite`, this
 * includes the row's own id/tenantId, the raw Tier 1 theme fields (not yet
 * grouped into `ThemeSettings`, see `SitesController.toDto`), and
 * `createdAt`. Shared between `apps/api`'s `SitesController` (server-side
 * shape) and `apps/editor-app`'s `sites-api-client.ts` (parses it off the
 * wire) — same reasoning as `publishedSiteSchema`.
 */
export const siteRecordSchema = businessInfoSchema.extend({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  domain: z.string().nullable(),
  defaultLocale: z.string(),
  enabledLocales: z.array(z.string()),
  untranslatedPageFallback: untranslatedPageFallbackSchema,
  searchEngineIndexingEnabled: z.boolean(),
  themePrimaryColor: hexColorSchema.nullable(),
  themeSecondaryColor: hexColorSchema.nullable(),
  themeFontFamily: z.string().nullable(),
  themeCustomCss: z.string().nullable(),
  themeHeadScript: z.string().nullable(),
  themeBodyScript: z.string().nullable(),
  themeFaviconUrl: z.string().nullable(),
  themeOverridesEnabled: z.boolean(),
  themeTokens: themeTokensSchema,
  // Date over the wire, always an ISO string — never revived to a Date on
  // the client (see http-client.ts's plain JSON.parse).
  createdAt: z.string(),
});
export type SiteRecord = z.infer<typeof siteRecordSchema>;
