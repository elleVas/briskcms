import { NotFoundException } from '@nestjs/common';
import { Site, SiteLayoutSection } from '@brisk/domain-core';
import type {
  PreviewTokenPort,
  SiteLayoutSectionRepositoryPort,
  SiteLayoutSectionVersionRepositoryPort,
  SiteRepositoryPort,
  TenantContextPort,
} from '@brisk/ports';
import { SiteLayoutSectionsController } from './site-layout-sections.controller.js';

function buildSection(
  overrides: Partial<Parameters<typeof SiteLayoutSection.create>[0]> = {},
) {
  return SiteLayoutSection.create({
    id: 'section-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    locale: 'it',
    kind: 'header',
    ...overrides,
  });
}

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
    themeTokens: null,
    createdAt: new Date(),
    ...overrides,
  });
}

describe('SiteLayoutSectionsController (unit)', () => {
  let siteLayoutSectionRepository: jest.Mocked<SiteLayoutSectionRepositoryPort>;
  let siteLayoutSectionVersionRepository: jest.Mocked<SiteLayoutSectionVersionRepositoryPort>;
  let siteRepository: jest.Mocked<SiteRepositoryPort>;
  let tenantContext: TenantContextPort;
  let previewTokenPort: jest.Mocked<PreviewTokenPort>;
  let controller: SiteLayoutSectionsController;

  beforeEach(() => {
    siteLayoutSectionRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findBySiteLocaleKind: jest.fn(),
    };
    siteLayoutSectionVersionRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      listBySection: jest.fn(),
    };
    siteRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByDomain: jest.fn(),
      updateThemeTokensBlockStyle: jest.fn(),
    };
    tenantContext = { getCurrentTenantId: () => 'tenant-1' };
    previewTokenPort = {
      createToken: jest.fn(),
      validateToken: jest.fn(),
    };
    controller = new SiteLayoutSectionsController(
      siteLayoutSectionRepository,
      siteLayoutSectionVersionRepository,
      siteRepository,
      tenantContext,
      previewTokenPort,
    );
  });

  it('findById throws a NotFoundException when no section matches', async () => {
    siteLayoutSectionRepository.findById.mockResolvedValue(null);

    await expect(controller.findById('missing-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getOrCreate maps a SiteNotFoundError to a NotFoundException', async () => {
    siteRepository.findById.mockResolvedValue(null);

    await expect(
      controller.getOrCreate({
        siteId: 'site-1',
        locale: 'it',
        kind: 'header',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('saveDraft maps a SiteLayoutSectionNotFoundError to a NotFoundException', async () => {
    siteLayoutSectionRepository.findById.mockResolvedValue(null);

    await expect(
      controller.saveDraft('missing-id', { content: [] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('publish maps a SiteLayoutSectionNotFoundError to a NotFoundException', async () => {
    siteLayoutSectionRepository.findById.mockResolvedValue(null);

    await expect(controller.publish('missing-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rollback maps a SiteLayoutSectionVersionNotFoundError to a NotFoundException', async () => {
    const section = buildSection();
    siteLayoutSectionRepository.findById.mockResolvedValue(section);
    siteLayoutSectionVersionRepository.findById.mockResolvedValue(null);

    await expect(
      controller.rollback(section.id, { versionId: 'missing-version' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lets unexpected errors from handleDomainErrors-wrapped actions propagate unchanged', async () => {
    const section = buildSection();
    siteLayoutSectionRepository.findById.mockResolvedValue(section);
    siteLayoutSectionRepository.save.mockRejectedValue(
      new Error('db exploded'),
    );

    await expect(
      controller.saveDraft(section.id, { content: [] }),
    ).rejects.toThrow('db exploded');
  });

  it('updateSticky maps a SiteLayoutSectionNotFoundError to a NotFoundException', async () => {
    siteLayoutSectionRepository.findById.mockResolvedValue(null);

    await expect(
      controller.updateSticky('missing-id', { sticky: true }),
    ).rejects.toThrow(NotFoundException);
  });

  it('updateSticky flips the flag and persists it', async () => {
    const section = buildSection();
    siteLayoutSectionRepository.findById.mockResolvedValue(section);

    const result = await controller.updateSticky(section.id, {
      sticky: true,
    });

    expect(result.sticky).toBe(true);
    expect(siteLayoutSectionRepository.save).toHaveBeenCalledWith(section);
  });

  it('getOrCreate returns the existing section instead of creating a new one', async () => {
    siteRepository.findById.mockResolvedValue(buildSite());
    const existing = buildSection();
    siteLayoutSectionRepository.findBySiteLocaleKind.mockResolvedValue(
      existing,
    );

    const result = await controller.getOrCreate({
      siteId: 'site-1',
      locale: 'it',
      kind: 'header',
    });

    expect(result.id).toBe(existing.id);
    expect(siteLayoutSectionRepository.save).not.toHaveBeenCalled();
  });

  it('createPreviewToken throws a NotFoundException when the section does not exist', async () => {
    siteLayoutSectionRepository.findById.mockResolvedValue(null);

    await expect(controller.createPreviewToken('missing-id')).rejects.toThrow(
      NotFoundException,
    );
    expect(previewTokenPort.createToken).not.toHaveBeenCalled();
  });

  it("createPreviewToken issues a token scoped to (tenant, section's own kind, sectionId)", async () => {
    const section = buildSection({ kind: 'footer' });
    siteLayoutSectionRepository.findById.mockResolvedValue(section);
    const expiresAt = new Date();
    previewTokenPort.createToken.mockResolvedValue({
      token: 'opaque-token',
      tenantId: 'tenant-1',
      contentType: 'footer',
      contentId: section.id,
      expiresAt,
    });

    const result = await controller.createPreviewToken(section.id);

    expect(previewTokenPort.createToken).toHaveBeenCalledWith(
      'tenant-1',
      'footer',
      section.id,
      expect.any(Number),
    );
    expect(result).toEqual({ token: 'opaque-token', expiresAt });
  });
});
