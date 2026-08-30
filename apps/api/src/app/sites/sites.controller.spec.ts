import { NotFoundException } from '@nestjs/common';
import { Site, SiteNotFoundError } from '@brisk/domain-core';
import type {
  SiteRepositoryPort,
  SiteThemeBlockStylesPort,
  TenantContextPort,
} from '@brisk/ports';
import { SitesController } from './sites.controller';

function buildSite(
  overrides: Partial<Parameters<typeof Site.fromProps>[0]> = {},
) {
  return Site.fromProps({
    id: 'site-1',
    tenantId: 'tenant-1',
    name: 'Il mio sito',
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
    createdAt: new Date(),
    ...overrides,
  });
}

describe('SitesController (unit)', () => {
  let siteRepository: jest.Mocked<SiteRepositoryPort>;
  let siteThemeBlockStylesRepository: jest.Mocked<SiteThemeBlockStylesPort>;
  let tenantContext: TenantContextPort;
  let controller: SitesController;

  beforeEach(() => {
    siteRepository = {
      findByDomain: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
    };
    siteThemeBlockStylesRepository = {
      listBySite: jest.fn().mockResolvedValue({}),
      upsert: jest.fn(),
    };
    tenantContext = { getCurrentTenantId: () => 'tenant-1' };
    controller = new SitesController(
      siteRepository,
      siteThemeBlockStylesRepository,
      tenantContext,
    );
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
    });

    expect(siteRepository.save).toHaveBeenCalled();
    expect(result.themePrimaryColor).toBe('#18181b');
    expect(result.themeFontFamily).toBe('inter');
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
