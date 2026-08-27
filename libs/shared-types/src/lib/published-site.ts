import { z } from 'zod';
import { businessInfoSchema } from './business-info.js';
import { untranslatedPageFallbackSchema } from './locale-settings.js';
import { themeSettingsSchema } from './site-theme-settings.js';
import { themeTokensSchema } from './site-theme-tokens.js';

/**
 * Only what the public renderer needs for OG tags + schema.org (docs/adr/0014)
 * and the language switcher (docs/adr/0017) — never the tenant id or anything
 * else internal. Shared by libs/application's resolve-site-chrome.ts (which
 * builds it server-side) and apps/public-site's public-api-client.ts (which
 * parses it off the wire) — same shape, validated at the network boundary
 * instead of two hand-copied interfaces hoped to stay in sync.
 */
export const publishedSiteSchema = businessInfoSchema.extend({
  name: z.string(),
  domain: z.string().nullable(),
  defaultLocale: z.string(),
  enabledLocales: z.array(z.string()),
  untranslatedPageFallback: untranslatedPageFallbackSchema,
  searchEngineIndexingEnabled: z.boolean(),
  /** Tier 1 of docs/adr/0021's theming model — layered by PageLayout.astro on top of the active filesystem theme (Tier 2). */
  themeSettings: themeSettingsSchema,
  /** Global Styles Editor (Fase 2a) — categorie di stile oltre ai colori (Bottoni oggi). */
  themeTokens: themeTokensSchema,
});
export type PublishedSite = z.infer<typeof publishedSiteSchema>;
