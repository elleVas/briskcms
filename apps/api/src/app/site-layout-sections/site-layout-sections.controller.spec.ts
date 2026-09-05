import { NotFoundException } from '@nestjs/common';
import {
  Site,
  SiteLayoutSection,
  SiteLayoutSectionNotFoundError,
  SiteLayoutSectionVersionNotFoundError,
  SiteNotFoundError,
} from '@brisk/domain-core';
import type {
  PreviewTokenPort,
  SiteLayoutSectionRepositoryPort,
  SiteLayoutSectionVersionRepositoryPort,
  SiteRepositoryPort,
  TenantContextPort,
} from '@brisk/ports';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';
import { SiteLayoutSectionsController } from './site-layout-sections.controller';

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
      listByTenant: jest.fn(),
    };
    tenantContext = {
      getCurrentTenantId: () => 'tenant-1',
      getCurrentUserId: () => 'user-1',
    };
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

  // The mapping to a 404 now happens in the global HttpExceptionFilter
  // (see http-exception.filter.spec.ts), not here — the controller's own
  // contract is just to let the domain error propagate unwrapped.
  it('getOrCreate propagates SiteNotFoundError, unwrapped', async () => {
    siteRepository.findById.mockResolvedValue(null);

    await expect(
      controller.getOrCreate({
        siteId: 'site-1',
        locale: 'it',
        kind: 'header',
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('saveDraft propagates SiteLayoutSectionNotFoundError, unwrapped', async () => {
    siteLayoutSectionRepository.findById.mockResolvedValue(null);

    await expect(
      controller.saveDraft('missing-id', { content: [] }),
    ).rejects.toThrow(SiteLayoutSectionNotFoundError);
  });

  it('publish propagates SiteLayoutSectionNotFoundError, unwrapped', async () => {
    siteLayoutSectionRepository.findById.mockResolvedValue(null);

    await expect(controller.publish('missing-id')).rejects.toThrow(
      SiteLayoutSectionNotFoundError,
    );
  });

  it('rollback propagates SiteLayoutSectionVersionNotFoundError, unwrapped', async () => {
    const section = buildSection();
    siteLayoutSectionRepository.findById.mockResolvedValue(section);
    siteLayoutSectionVersionRepository.findById.mockResolvedValue(null);

    await expect(
      controller.rollback(section.id, { versionId: 'missing-version' }),
    ).rejects.toThrow(SiteLayoutSectionVersionNotFoundError);
  });

  it('lets unexpected errors propagate unchanged', async () => {
    const section = buildSection();
    siteLayoutSectionRepository.findById.mockResolvedValue(section);
    siteLayoutSectionRepository.save.mockRejectedValue(
      new Error('db exploded'),
    );

    await expect(
      controller.saveDraft(section.id, { content: [] }),
    ).rejects.toThrow('db exploded');
  });

  it('updateSticky propagates SiteLayoutSectionNotFoundError, unwrapped', async () => {
    siteLayoutSectionRepository.findById.mockResolvedValue(null);

    await expect(
      controller.updateSticky('missing-id', { sticky: true }),
    ).rejects.toThrow(SiteLayoutSectionNotFoundError);
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
