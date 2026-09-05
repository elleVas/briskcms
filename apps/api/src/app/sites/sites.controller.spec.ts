import { NotFoundException } from '@nestjs/common';
import {
  InvalidThemeNameError,
  Site,
  SiteNotFoundError,
} from '@brisk/domain-core';
import type {
  SiteRepositoryPort,
  SiteThemeBlockStylesPort,
  TenantContextPort,
  ThemeCatalogPort,
} from '@brisk/ports';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';
import { DeploymentSiteResolver } from './deployment-site.resolver';
import { SitesController } from './sites.controller';

function buildSite(
  overrides: Partial<Parameters<typeof Site.fromProps>[0]> = {},
) {
  return Site.fromProps({
    id: 'site-1',
    tenantId: 'tenant-1',
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
    ...overrides,
  });
}

describe('SitesController (unit)', () => {
  let siteRepository: jest.Mocked<SiteRepositoryPort>;
  let siteThemeBlockStylesRepository: jest.Mocked<SiteThemeBlockStylesPort>;
  let themeCatalog: jest.Mocked<ThemeCatalogPort>;
  let tenantContext: TenantContextPort;
  let controller: SitesController;

  beforeEach(() => {
    siteRepository = {
      findByDomain: jest.fn(),
      listByTenant: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
    };
    siteThemeBlockStylesRepository = {
      listBySite: jest.fn().mockResolvedValue({}),
      upsert: jest.fn(),
    };
    themeCatalog = {
      listAvailableThemes: jest
        .fn()
        .mockResolvedValue([{ name: 'classic' }, { name: 'docs-showcase' }]),
    };
    tenantContext = {
      getCurrentTenantId: () => 'tenant-1',
      getCurrentUserId: () => 'user-1',
    };
    // A real resolver over the same mocked repository, not a mock of its
    // own: its whole behaviour is which repository call it makes and what
    // it does with the result, so mocking it would test nothing.
    controller = new SitesController(
      siteRepository,
      siteThemeBlockStylesRepository,
      themeCatalog,
      tenantContext,
      new DeploymentSiteResolver(siteRepository, undefined),
    );
  });

  it('findCurrent returns the site this deployment edits, without being given an id', async () => {
    const site = buildSite();
    siteRepository.listByTenant.mockResolvedValue([site]);

    const dto = await controller.findCurrent();

    expect(siteRepository.listByTenant).toHaveBeenCalledWith('tenant-1');
    expect(dto.id).toBe('site-1');
  });

  it('findById throws a NotFoundException when no site matches', async () => {
    siteRepository.findById.mockResolvedValue(null);

    await expect(controller.findById('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('findById returns the site props, with themeTokens composed from the block styles repository', async () => {
    siteRepository.findById.mockResolvedValue(buildSite());
    siteThemeBlockStylesRepository.listBySite.mockResolvedValue({
      Button: { borderRadius: '9999px' },
    });

    const result = await controller.findById('site-1');

    expect(result.name).toBe('Il mio sito');
    expect(result.themeTokens).toEqual({
      blockStyles: { Button: { borderRadius: '9999px' } },
    });
  });

  // The mapping to a 404 now happens in the global HttpExceptionFilter
  // (see http-exception.filter.spec.ts), not here — the controller's own
  // contract is just to let the domain error propagate unwrapped.
  it('updateBusinessInfo propagates SiteNotFoundError, unwrapped', async () => {
    siteRepository.findById.mockResolvedValue(null);

    await expect(
      controller.updateBusinessInfo('missing', {
        businessAddress: null,
        businessPhone: null,
        businessType: null,
        openingHours: null,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('updateBusinessInfo saves the updated site', async () => {
    siteRepository.findById.mockResolvedValue(buildSite());

    const result = await controller.updateBusinessInfo('site-1', {
      businessAddress: 'Via Roma 1',
      businessPhone: '+39 02 1234567',
      businessType: 'Restaurant',
      openingHours: null,
    });

    expect(siteRepository.save).toHaveBeenCalled();
    expect(result.businessAddress).toBe('Via Roma 1');
  });

  it('updateGeneralSettings propagates SiteNotFoundError, unwrapped', async () => {
    siteRepository.findById.mockResolvedValue(null);

    await expect(
      controller.updateGeneralSettings('missing', {
        name: 'x',
        domain: null,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('updateGeneralSettings saves the updated site', async () => {
    siteRepository.findById.mockResolvedValue(buildSite());

    const result = await controller.updateGeneralSettings('site-1', {
      name: 'Il mio ristorante',
      domain: 'ilmioristorante.it',
    });

    expect(siteRepository.save).toHaveBeenCalled();
    expect(result.name).toBe('Il mio ristorante');
    expect(result.domain).toBe('ilmioristorante.it');
  });

  it('updateSeoSettings propagates SiteNotFoundError, unwrapped', async () => {
    siteRepository.findById.mockResolvedValue(null);

    await expect(
      controller.updateSeoSettings('missing', {
        searchEngineIndexingEnabled: true,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('updateSeoSettings saves the updated site', async () => {
    siteRepository.findById.mockResolvedValue(buildSite());

    const result = await controller.updateSeoSettings('site-1', {
      searchEngineIndexingEnabled: true,
    });

    expect(siteRepository.save).toHaveBeenCalled();
    expect(result.searchEngineIndexingEnabled).toBe(true);
  });

  it('updateFormSubmissionRetention propagates SiteNotFoundError, unwrapped', async () => {
    siteRepository.findById.mockResolvedValue(null);

    await expect(
      controller.updateFormSubmissionRetention('missing', {
        formSubmissionRetentionDays: 30,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('updateFormSubmissionRetention saves the updated site', async () => {
    siteRepository.findById.mockResolvedValue(buildSite());

    const result = await controller.updateFormSubmissionRetention('site-1', {
      formSubmissionRetentionDays: 30,
    });

    expect(siteRepository.save).toHaveBeenCalled();
    expect(result.formSubmissionRetentionDays).toBe(30);
  });

  it('listAvailableThemes returns the theme catalog', async () => {
    const result = await controller.listAvailableThemes();

    expect(result).toEqual([{ name: 'classic' }, { name: 'docs-showcase' }]);
  });

  it('updateThemePackage propagates SiteNotFoundError, unwrapped', async () => {
    siteRepository.findById.mockResolvedValue(null);

    await expect(
      controller.updateThemePackage('missing', { themeName: 'classic' }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('updateThemePackage rejects a themeName not in the catalog', async () => {
    siteRepository.findById.mockResolvedValue(buildSite());

    await expect(
      controller.updateThemePackage('site-1', { themeName: 'not-bundled' }),
    ).rejects.toThrow(InvalidThemeNameError);
    expect(siteRepository.save).not.toHaveBeenCalled();
  });

  it('updateThemePackage saves the updated site', async () => {
    siteRepository.findById.mockResolvedValue(buildSite());

    const result = await controller.updateThemePackage('site-1', {
      themeName: 'docs-showcase',
    });

    expect(siteRepository.save).toHaveBeenCalled();
    expect(result.themeName).toBe('docs-showcase');
  });

  it('updateThemeSettings propagates SiteNotFoundError, unwrapped', async () => {
    siteRepository.findById.mockResolvedValue(null);

    await expect(
      controller.updateThemeSettings('missing', {
        primaryColor: null,
        secondaryColor: null,
        fontFamily: null,
        customCss: null,
        headScript: null,
        bodyScript: null,
        faviconUrl: null,
        overridesEnabled: true,
        allowedTrackerDomains: [],
        trackerScripts: [],
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('updateThemeSettings saves the updated site', async () => {
    siteRepository.findById.mockResolvedValue(buildSite());

    const result = await controller.updateThemeSettings('site-1', {
      primaryColor: '#18181b',
      secondaryColor: null,
      fontFamily: 'inter',
      customCss: null,
      headScript: null,
      bodyScript: null,
      faviconUrl: null,
      overridesEnabled: true,
      allowedTrackerDomains: [],
      trackerScripts: [],
    });

    expect(siteRepository.save).toHaveBeenCalled();
    expect(result.themePrimaryColor).toBe('#18181b');
    expect(result.themeFontFamily).toBe('inter');
  });

  it('updateCookieBannerSettings propagates SiteNotFoundError, unwrapped', async () => {
    siteRepository.findById.mockResolvedValue(null);

    await expect(
      controller.updateCookieBannerSettings('missing', {
        ...DEFAULT_COOKIE_BANNER_SETTINGS,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('updateCookieBannerSettings saves the updated site', async () => {
    siteRepository.findById.mockResolvedValue(buildSite());

    const result = await controller.updateCookieBannerSettings('site-1', {
      ...DEFAULT_COOKIE_BANNER_SETTINGS,
      enabled: true,
      position: 'bottom-right',
    });

    expect(siteRepository.save).toHaveBeenCalled();
    expect(result.cookieBannerSettings.enabled).toBe(true);
    expect(result.cookieBannerSettings.position).toBe('bottom-right');
  });

  it('updateThemeTokens propagates SiteNotFoundError, unwrapped', async () => {
    siteRepository.findById.mockResolvedValue(null);

    await expect(
      controller.updateThemeTokens('missing', {
        blockType: 'Button',
        style: { borderRadius: '6px' },
      }),
    ).rejects.toThrow(SiteNotFoundError);
    expect(siteThemeBlockStylesRepository.upsert).not.toHaveBeenCalled();
  });

  it('updateThemeTokens upserts the override for only the block type given', async () => {
    siteRepository.findById.mockResolvedValue(buildSite());
    siteThemeBlockStylesRepository.listBySite.mockResolvedValue({
      Button: { borderRadius: '9999px', paddingX: '1.5rem' },
    });

    const result = await controller.updateThemeTokens('site-1', {
      blockType: 'Button',
      style: { borderRadius: '9999px', paddingX: '1.5rem' },
    });

    expect(siteThemeBlockStylesRepository.upsert).toHaveBeenCalledWith(
      'tenant-1',
      'site-1',
      'Button',
      { borderRadius: '9999px', paddingX: '1.5rem' },
    );
    expect(result.themeTokens).toEqual({
      blockStyles: {
        Button: { borderRadius: '9999px', paddingX: '1.5rem' },
      },
    });
  });
});
