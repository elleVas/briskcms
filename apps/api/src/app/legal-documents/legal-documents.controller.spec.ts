import { SiteNotFoundError } from '@brisk/domain-core';
import type { TenantContextPort } from '@brisk/ports';
import {
  buildSite,
  InMemoryPageGroupRepository,
  InMemoryPageTranslationRepository,
  InMemorySiteRepository,
} from '@brisk/testing';
import { LegalDocumentsController } from './legal-documents.controller';
import type { GenerateLegalDocumentsBody } from './legal-documents.schemas';

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
  let siteRepository: InMemorySiteRepository;
  let pageGroupRepository: InMemoryPageGroupRepository;
  let pageTranslationRepository: InMemoryPageTranslationRepository;
  let tenantContext: TenantContextPort;
  let controller: LegalDocumentsController;

  beforeEach(() => {
    siteRepository = new InMemorySiteRepository();
    pageTranslationRepository = new InMemoryPageTranslationRepository();
    pageGroupRepository = new InMemoryPageGroupRepository(
      undefined,
      pageTranslationRepository,
    );
    jest.spyOn(pageGroupRepository, 'saveWithVersion');
    jest.spyOn(pageTranslationRepository, 'save');
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
      await expect(
        controller.generate('missing-site', {
          documents: ['privacy-policy'],
          locales: ['it'],
          answers,
        }),
      ).rejects.toThrow(SiteNotFoundError);
    });

    it('creates drafts and returns one entry per document, with a translation per locale', async () => {
      await siteRepository.save(buildSite({ enabledLocales: ['it', 'en'] }));

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
