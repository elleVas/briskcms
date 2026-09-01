import { describe, expect, it } from 'vitest';
import { SiteNotFoundError, Site } from '@brisk/domain-core';
import { updateSiteBusinessInfo } from './update-site-business-info.use-case';
import { updateSiteGeneralSettings } from './update-site-general-settings.use-case';
import { updateSiteSeoSettings } from './update-site-seo-settings.use-case';
import { updateSiteFormSubmissionRetention } from './update-site-form-submission-retention.use-case';
import { updateSiteThemeSettings } from './update-site-theme-settings.use-case';
import { updateSiteLocaleSettings } from './update-site-locale-settings.use-case';
import { InMemorySiteRepository } from './in-memory-repositories.test-fixture';

describe('updateSiteBusinessInfo', () => {
  const tenantId = 'tenant-1';
  const otherTenantId = 'tenant-2';

  function setup() {
    const siteRepository = new InMemorySiteRepository();
    return { siteRepository };
  }

  async function seedSite(siteRepository: InMemorySiteRepository) {
    const site = Site.fromProps({
      id: 'site-1',
      tenantId,
      name: 'Il mio ristorante',
      domain: 'example.com',
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
      createdAt: new Date(),
    });
    await siteRepository.save(site);
    return site;
  }

  it('sets the business fields on the site', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const updated = await updateSiteBusinessInfo(deps, {
      tenantId,
      siteId: 'site-1',
      businessAddress: 'Via Roma 1, Milano',
      businessPhone: '+39 02 1234567',
      businessType: 'Restaurant',
      openingHours: [
        {
          dayOfWeek: 'monday',
          ranges: [{ opens: '12:00', closes: '15:00' }],
        },
      ],
    });

    expect(updated.businessAddress).toBe('Via Roma 1, Milano');
    expect(updated.hasBusinessInfo()).toBe(true);
  });

  it('throws SiteNotFoundError for a nonexistent site', async () => {
    const deps = setup();

    await expect(
      updateSiteBusinessInfo(deps, {
        tenantId,
        siteId: 'does-not-exist',
        businessAddress: null,
        businessPhone: null,
        businessType: null,
        openingHours: null,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('does not update a site belonging to a different tenant', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    await expect(
      updateSiteBusinessInfo(deps, {
        tenantId: otherTenantId,
        siteId: 'site-1',
        businessAddress: 'Somewhere else',
        businessPhone: null,
        businessType: null,
        openingHours: null,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });
});

describe('updateSiteGeneralSettings', () => {
  const tenantId = 'tenant-1';
  const otherTenantId = 'tenant-2';

  function setup() {
    const siteRepository = new InMemorySiteRepository();
    return { siteRepository };
  }

  async function seedSite(siteRepository: InMemorySiteRepository) {
    const site = Site.fromProps({
      id: 'site-1',
      tenantId,
      name: 'Il mio sito',
      domain: 'localhost',
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
      createdAt: new Date(),
    });
    await siteRepository.save(site);
    return site;
  }

  it('sets the name and domain', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const updated = await updateSiteGeneralSettings(deps, {
      tenantId,
      siteId: 'site-1',
      name: 'Il mio ristorante',
      domain: 'ilmioristorante.it',
    });

    expect(updated.name).toBe('Il mio ristorante');
    expect(updated.domain).toBe('ilmioristorante.it');
  });

  it('throws SiteNotFoundError for a nonexistent site', async () => {
    const deps = setup();

    await expect(
      updateSiteGeneralSettings(deps, {
        tenantId,
        siteId: 'does-not-exist',
        name: 'x',
        domain: null,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('does not update a site belonging to a different tenant', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    await expect(
      updateSiteGeneralSettings(deps, {
        tenantId: otherTenantId,
        siteId: 'site-1',
        name: 'hijacked',
        domain: 'hijacked.example.com',
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });
});

describe('updateSiteSeoSettings', () => {
  const tenantId = 'tenant-1';
  const otherTenantId = 'tenant-2';

  function setup() {
    const siteRepository = new InMemorySiteRepository();
    return { siteRepository };
  }

  async function seedSite(siteRepository: InMemorySiteRepository) {
    const site = Site.fromProps({
      id: 'site-1',
      tenantId,
      name: 'Il mio sito',
      domain: 'localhost',
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
      createdAt: new Date(),
    });
    await siteRepository.save(site);
    return site;
  }

  it('enables search engine indexing', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const updated = await updateSiteSeoSettings(deps, {
      tenantId,
      siteId: 'site-1',
      searchEngineIndexingEnabled: true,
    });

    expect(updated.searchEngineIndexingEnabled).toBe(true);
  });

  it('throws SiteNotFoundError for a nonexistent site', async () => {
    const deps = setup();

    await expect(
      updateSiteSeoSettings(deps, {
        tenantId,
        siteId: 'does-not-exist',
        searchEngineIndexingEnabled: true,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('does not update a site belonging to a different tenant', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    await expect(
      updateSiteSeoSettings(deps, {
        tenantId: otherTenantId,
        siteId: 'site-1',
        searchEngineIndexingEnabled: true,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });
});

describe('updateSiteFormSubmissionRetention', () => {
  const tenantId = 'tenant-1';
  const otherTenantId = 'tenant-2';

  function setup() {
    const siteRepository = new InMemorySiteRepository();
    return { siteRepository };
  }

  async function seedSite(siteRepository: InMemorySiteRepository) {
    const site = Site.fromProps({
      id: 'site-1',
      tenantId,
      name: 'Il mio sito',
      domain: 'localhost',
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
      createdAt: new Date(),
    });
    await siteRepository.save(site);
    return site;
  }

  it('sets the retention window in days', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const updated = await updateSiteFormSubmissionRetention(deps, {
      tenantId,
      siteId: 'site-1',
      formSubmissionRetentionDays: 30,
    });

    expect(updated.formSubmissionRetentionDays).toBe(30);
  });

  it('clears the retention window back to null (keep forever)', async () => {
    const deps = setup();
    const site = await seedSite(deps.siteRepository);
    site.updateFormSubmissionRetention({ formSubmissionRetentionDays: 30 });
    await deps.siteRepository.save(site);

    const updated = await updateSiteFormSubmissionRetention(deps, {
      tenantId,
      siteId: 'site-1',
      formSubmissionRetentionDays: null,
    });

    expect(updated.formSubmissionRetentionDays).toBeNull();
  });

  it('throws SiteNotFoundError for a nonexistent site', async () => {
    const deps = setup();

    await expect(
      updateSiteFormSubmissionRetention(deps, {
        tenantId,
        siteId: 'does-not-exist',
        formSubmissionRetentionDays: 30,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('does not update a site belonging to a different tenant', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    await expect(
      updateSiteFormSubmissionRetention(deps, {
        tenantId: otherTenantId,
        siteId: 'site-1',
        formSubmissionRetentionDays: 30,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });
});

describe('updateSiteThemeSettings', () => {
  const tenantId = 'tenant-1';
  const otherTenantId = 'tenant-2';

  function setup() {
    const siteRepository = new InMemorySiteRepository();
    return { siteRepository };
  }

  async function seedSite(siteRepository: InMemorySiteRepository) {
    const site = Site.fromProps({
      id: 'site-1',
      tenantId,
      name: 'Il mio sito',
      domain: 'localhost',
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
      createdAt: new Date(),
    });
    await siteRepository.save(site);
    return site;
  }

  it('sets the theme fields on the site', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const updated = await updateSiteThemeSettings(deps, {
      tenantId,
      siteId: 'site-1',
      primaryColor: '#18181b',
      secondaryColor: null,
      fontFamily: 'inter',
      customCss: null,
      headScript: null,
      bodyScript: null,
      faviconUrl: null,
      overridesEnabled: true,
      allowedTrackerDomains: [],
    });

    expect(updated.themeSettings.primaryColor).toBe('#18181b');
    expect(updated.themeSettings.fontFamily).toBe('inter');
  });

  it('throws SiteNotFoundError for a nonexistent site', async () => {
    const deps = setup();

    await expect(
      updateSiteThemeSettings(deps, {
        tenantId,
        siteId: 'does-not-exist',
        primaryColor: null,
        secondaryColor: null,
        fontFamily: null,
        customCss: null,
        headScript: null,
        bodyScript: null,
        faviconUrl: null,
        overridesEnabled: true,
        allowedTrackerDomains: [],
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('does not update a site belonging to a different tenant', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    await expect(
      updateSiteThemeSettings(deps, {
        tenantId: otherTenantId,
        siteId: 'site-1',
        primaryColor: '#18181b',
        secondaryColor: null,
        fontFamily: null,
        customCss: null,
        headScript: null,
        bodyScript: null,
        faviconUrl: null,
        overridesEnabled: true,
        allowedTrackerDomains: [],
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });
});

describe('updateSiteLocaleSettings', () => {
  const tenantId = 'tenant-1';
  const otherTenantId = 'tenant-2';

  function setup() {
    const siteRepository = new InMemorySiteRepository();
    return { siteRepository };
  }

  async function seedSite(siteRepository: InMemorySiteRepository) {
    const site = Site.fromProps({
      id: 'site-1',
      tenantId,
      name: 'Il mio sito',
      domain: 'localhost',
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
      createdAt: new Date(),
    });
    await siteRepository.save(site);
    return site;
  }

  it('sets the default/enabled locales and the untranslated-page fallback', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const updated = await updateSiteLocaleSettings(deps, {
      tenantId,
      siteId: 'site-1',
      defaultLocale: 'en',
      enabledLocales: ['it', 'en'],
      untranslatedPageFallback: 'not-available',
    });

    expect(updated.defaultLocale).toBe('en');
    expect(updated.enabledLocales).toEqual(['it', 'en']);
    expect(updated.untranslatedPageFallback).toBe('not-available');
  });

  it('throws SiteNotFoundError for a nonexistent site', async () => {
    const deps = setup();

    await expect(
      updateSiteLocaleSettings(deps, {
        tenantId,
        siteId: 'does-not-exist',
        defaultLocale: 'it',
        enabledLocales: ['it'],
        untranslatedPageFallback: 'redirect-to-default',
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('does not update a site belonging to a different tenant', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    await expect(
      updateSiteLocaleSettings(deps, {
        tenantId: otherTenantId,
        siteId: 'site-1',
        defaultLocale: 'en',
        enabledLocales: ['en'],
        untranslatedPageFallback: 'not-available',
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });
});
