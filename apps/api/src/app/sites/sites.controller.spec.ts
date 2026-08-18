import { NotFoundException } from '@nestjs/common';
import { Site } from '@brisk/domain-core';
import type { SiteRepositoryPort, TenantContextPort } from '@brisk/ports';
import { SitesController } from './sites.controller.js';

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
    businessAddress: null,
    businessPhone: null,
    businessType: null,
    openingHours: null,
    searchEngineIndexingEnabled: false,
    createdAt: new Date(),
    ...overrides,
  });
}

describe('SitesController (unit)', () => {
  let siteRepository: jest.Mocked<SiteRepositoryPort>;
  let tenantContext: TenantContextPort;
  let controller: SitesController;

  beforeEach(() => {
    siteRepository = {
      findByDomain: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
    };
    tenantContext = { getCurrentTenantId: () => 'tenant-1' };
    controller = new SitesController(siteRepository, tenantContext);
  });

  it('findById throws a NotFoundException when no site matches', async () => {
    siteRepository.findById.mockResolvedValue(null);

    await expect(controller.findById('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('findById returns the site props when found', async () => {
    siteRepository.findById.mockResolvedValue(buildSite());

    const result = await controller.findById('site-1');

    expect(result.name).toBe('Il mio sito');
  });

  it('updateBusinessInfo maps a SiteNotFoundError to a NotFoundException', async () => {
    siteRepository.findById.mockResolvedValue(null);

    await expect(
      controller.updateBusinessInfo('missing', {
        businessAddress: null,
        businessPhone: null,
        businessType: null,
        openingHours: null,
      }),
    ).rejects.toThrow(NotFoundException);
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

  it('updateGeneralSettings maps a SiteNotFoundError to a NotFoundException', async () => {
    siteRepository.findById.mockResolvedValue(null);

    await expect(
      controller.updateGeneralSettings('missing', {
        name: 'x',
        domain: null,
      }),
    ).rejects.toThrow(NotFoundException);
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

  it('updateSeoSettings maps a SiteNotFoundError to a NotFoundException', async () => {
    siteRepository.findById.mockResolvedValue(null);

    await expect(
      controller.updateSeoSettings('missing', {
        searchEngineIndexingEnabled: true,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('updateSeoSettings saves the updated site', async () => {
    siteRepository.findById.mockResolvedValue(buildSite());

    const result = await controller.updateSeoSettings('site-1', {
      searchEngineIndexingEnabled: true,
    });

    expect(siteRepository.save).toHaveBeenCalled();
    expect(result.searchEngineIndexingEnabled).toBe(true);
  });
});
