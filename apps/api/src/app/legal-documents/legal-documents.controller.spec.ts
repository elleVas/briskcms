import { Site, SiteNotFoundError } from '@brisk/domain-core';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';
import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
  SiteRepositoryPort,
  TenantContextPort,
} from '@brisk/ports';
import { LegalDocumentsController } from './legal-documents.controller';
import type { GenerateLegalDocumentsBody } from './legal-documents.schemas';

function buildSite() {
  return Site.fromProps({
    id: 'site-1',
    tenantId: 'tenant-1',
    name: 'Il mio sito',
    domain: 'example.com',
    themeName: 'classic',
    defaultLocale: 'it',
    enabledLocales: ['it', 'en'],
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
}

const answers: GenerateLegalDocumentsBody['answers'] = {
  legalEntityName: 'Acme Srl',
  contactEmail: 'privacy@example.com',
  address: null,
  phone: null,
  vatId: null,
  domain: 'example.com',
  dataCollected: { contactForm: true, newsletter: false, accounts: false },
  thirdPartyServices: [],
  retentionDays: null,
  jurisdictionCountry: 'Italia',
};

describe('LegalDocumentsController (unit)', () => {
  let siteRepository: jest.Mocked<SiteRepositoryPort>;
  let pageGroupRepository: jest.Mocked<PageGroupRepositoryPort>;
  let pageTranslationRepository: jest.Mocked<PageTranslationRepositoryPort>;
  let tenantContext: TenantContextPort;
  let controller: LegalDocumentsController;

  beforeEach(() => {
    siteRepository = {
      findByDomain: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
    };
    pageGroupRepository = {
      save: jest.fn(),
      saveWithVersion: jest.fn(),
      findById: jest.fn(),
      listBySite: jest.fn(),
      listBySiteFiltered: jest.fn(),
      listSiblings: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
    };
    pageTranslationRepository = {
      save: jest.fn(),
      saveWithVersion: jest.fn(),
      findById: jest.fn(),
      findByGroupAndLocale: jest.fn(),
      listByGroup: jest.fn(),
      findByParentGroupAndLocaleSlug: jest.fn().mockResolvedValue(null),
      delete: jest.fn(),
    };
    tenantContext = {
      getCurrentTenantId: () => 'tenant-1',
      getCurrentUserId: () => 'user-1',
    };
    controller = new LegalDocumentsController(
      siteRepository,
      pageGroupRepository,
      pageTranslationRepository,
      tenantContext,
    );
  });

  describe('generate', () => {
    it('propagates SiteNotFoundError, unwrapped', async () => {
      siteRepository.findById.mockResolvedValue(null);

      await expect(
        controller.generate('missing-site', {
          documents: ['privacy-policy'],
          locales: ['it'],
          answers,
        }),
      ).rejects.toThrow(SiteNotFoundError);
    });

    it('creates drafts and returns one entry per document, with a translation per locale', async () => {
      siteRepository.findById.mockResolvedValue(buildSite());

      const result = await controller.generate('site-1', {
        documents: ['privacy-policy', 'cookie-policy'],
        locales: ['it', 'en'],
        answers,
      });

      expect(result.documents).toHaveLength(2);
      expect(pageGroupRepository.saveWithVersion).toHaveBeenCalledTimes(2);
      for (const doc of result.documents) {
        expect(doc.translations.map((t) => t.locale).sort()).toEqual([
          'en',
          'it',
        ]);
      }
    });
  });

  describe('preview', () => {
    it('does not persist anything', async () => {
      await controller.preview({
        documents: ['terms-conditions'],
        locales: ['it', 'en'],
        answers: { ...answers, jurisdictionCountry: 'Italia' },
      });

      expect(pageGroupRepository.saveWithVersion).not.toHaveBeenCalled();
      expect(pageTranslationRepository.save).not.toHaveBeenCalled();
    });

    it('returns readable text per document per requested locale', async () => {
      const result = await controller.preview({
        documents: ['cookie-policy'],
        locales: ['it', 'en'],
        answers,
      });

      expect(result.documents).toHaveLength(1);
      const { locales } = result.documents[0];
      expect(locales['it'].title.length).toBeGreaterThan(0);
      expect(locales['en'].title.length).toBeGreaterThan(0);
      expect(locales['it'].sections.length).toBeGreaterThan(0);
    });
  });
});
