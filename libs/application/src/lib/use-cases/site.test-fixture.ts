import { Site, type SiteProps } from '@brisk/domain-core';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';

/**
 * A site with every setting at its neutral value, for a test that cares
 * about one or two of them and says which through `overrides`.
 *
 * `Site` has no `create`, only `fromProps`, so a spec otherwise spells out
 * every one of its props to state that its site's default language is
 * Italian.
 */
export function buildSite(overrides: Partial<SiteProps> = {}): Site {
  return Site.fromProps({
    id: 'site-1',
    tenantId: 'tenant-1',
    name: 'Test site',
    domain: 'example.com',
    themeName: 'classic',
    defaultLocale: 'it',
    enabledLocales: ['it'],
    untranslatedPageFallback: 'redirect-to-default',
    businessAddress: null,
    businessPhone: null,
    businessEmail: null,
    businessType: null,
    openingHours: null,
    searchEngineIndexingEnabled: false,
    themePrimaryColor: null,
    themeSecondaryColor: null,
    themeFontFamily: null,
    themeCustomCss: null,
    themeContentWidth: null,
    themeHeadScript: null,
    themeBodyScript: null,
    themeFaviconUrl: null,
    themeOverridesEnabled: true,
    themeAllowedTrackerDomains: [],
    formSubmissionRetentionDays: null,
    themeTrackerScripts: [],
    cookieBannerSettings: DEFAULT_COOKIE_BANNER_SETTINGS,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });
}
