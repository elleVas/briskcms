import { describe, expect, it } from 'vitest';
import {
  InvalidThemeNameError,
  Site,
  SiteNotFoundError,
} from '@brisk/domain-core';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';
import { updateSiteThemePackage } from './update-site-theme-package.use-case';
import {
  InMemorySiteRepository,
  InMemoryThemeCatalog,
} from './in-memory-repositories.test-fixture';

describe('updateSiteThemePackage', () => {
  const tenantId = 'tenant-1';
  const otherTenantId = 'tenant-2';

  function setup() {
    const siteRepository = new InMemorySiteRepository();
    const themeCatalog = new InMemoryThemeCatalog([
      { name: 'classic' },
      { name: 'docs-showcase' },
    ]);
    return { siteRepository, themeCatalog };
  }

  async function seedSite(siteRepository: InMemorySiteRepository) {
    const site = Site.fromProps({
      id: 'site-1',
      tenantId,
      name: 'Il mio sito',
      domain: 'example.com',
      themeName: 'classic',
      defaultLocale: 'it',
      enabledLocales: ['it'],
      untranslatedPageFallback: 'redirect-to-default',
      businessAddress: null,
      businessPhone: null,
      businessType: null,
      openingHours: null,
      searchEngineIndexingEnabled: false,
      themePrimaryColor: null,
      themeSecondaryColor: null,
      themeFontFamily: null,
      themeCustomCss: null,
      themeHeadScript: null,
      themeBodyScript: null,
      themeFaviconUrl: null,
      themeOverridesEnabled: true,
      themeAllowedTrackerDomains: [],
      formSubmissionRetentionDays: null,
      themeTrackerScripts: [],
      cookieBannerSettings: DEFAULT_COOKIE_BANNER_SETTINGS,
      createdAt: new Date(),
    });
    await siteRepository.save(site);
    return site;
  }

  it('switches to a different bundled theme', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const updated = await updateSiteThemePackage(deps, {
      tenantId,
      siteId: 'site-1',
      themeName: 'docs-showcase',
    });

    expect(updated.themeName).toBe('docs-showcase');
  });

  it('throws SiteNotFoundError for a nonexistent site', async () => {
    const deps = setup();

    await expect(
      updateSiteThemePackage(deps, {
        tenantId,
        siteId: 'does-not-exist',
        themeName: 'classic',
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('does not update a site belonging to a different tenant', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    await expect(
      updateSiteThemePackage(deps, {
        tenantId: otherTenantId,
        siteId: 'site-1',
        themeName: 'docs-showcase',
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('rejects a themeName this deployment does not bundle', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    await expect(
      updateSiteThemePackage(deps, {
        tenantId,
        siteId: 'site-1',
        themeName: 'nonexistent-theme',
      }),
    ).rejects.toThrow(InvalidThemeNameError);
  });
});
