import { z } from 'zod';
import { businessInfoSchema } from './business-info';
import { cookieBannerSettingsSchema } from './cookie-consent';
import { untranslatedPageFallbackSchema } from './locale-settings';
import { themeSettingsSchema } from './site-theme-settings';
import { themeTokensSchema } from './site-theme-tokens';

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
  /** Cookie consent banner config (docs/adr/0039). */
  cookieBannerSettings: cookieBannerSettingsSchema,
  // Resolved from cookieBannerSettings.privacyPolicyPageGroupId/
  // cookiePolicyPageGroupId to THIS locale's own published slug
  // (resolve-site-chrome.ts) — `null` when unset, not yet translated into
  // this locale, or not yet published. A bare slug, not a full path: both
  // generated pages are always created at site root (parentId: null), so
  // apps/public-site's localePath(locale, slug) is enough to build the href.
  privacyPolicySlug: z.string().nullable(),
  cookiePolicySlug: z.string().nullable(),
});
export type PublishedSite = z.infer<typeof publishedSiteSchema>;
