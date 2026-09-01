import { describe, expect, it } from 'vitest';
import type { LegalDocumentAnswers } from './legal-document-input';
import type { LegalDocumentTemplate } from './legal-document-section';
import { privacyPolicyTemplate } from './privacy-policy.template';
import { cookiePolicyTemplate } from './cookie-policy.template';
import { termsConditionsTemplate } from './terms-conditions.template';
import { buildLegalPageContent } from './build-legal-page-content';
import { DRAFT_NOTICE_TEXT } from './legal-document-formatting';

const answers: LegalDocumentAnswers = {
  legalEntityName: 'Acme Srl',
  contactEmail: 'privacy@example.com',
  address: 'Via Roma 1, Milano',
  phone: '+39 02 1234567',
  vatId: 'IT12345678901',
  domain: 'example.com',
  dataCollected: { contactForm: true, newsletter: true, accounts: false },
  thirdPartyServices: ['Google Analytics', 'Meta Pixel'],
  retentionDays: 90,
  jurisdictionCountry: 'Italia',
};

const emptyAnswers: LegalDocumentAnswers = {
  legalEntityName: 'Acme Srl',
  contactEmail: 'privacy@example.com',
  address: null,
  phone: null,
  vatId: null,
  domain: null,
  dataCollected: { contactForm: false, newsletter: false, accounts: false },
  thirdPartyServices: [],
  retentionDays: null,
  jurisdictionCountry: 'Italia',
};

const TEMPLATES: Record<string, LegalDocumentTemplate> = {
  'privacy-policy': privacyPolicyTemplate,
  'cookie-policy': cookiePolicyTemplate,
  'terms-conditions': termsConditionsTemplate,
};

describe.each(Object.entries(TEMPLATES))('%s template', (_name, template) => {
  it.each([answers, emptyAnswers])(
    'produces a non-empty title and at least one section, in both locales',
    (input) => {
      for (const locale of ['it', 'en'] as const) {
        const outline = template[locale](input);
        expect(outline.title.length).toBeGreaterThan(0);
        expect(outline.sections.length).toBeGreaterThan(0);
        for (const section of outline.sections) {
          expect(section.heading.length).toBeGreaterThan(0);
          expect(section.paragraphs.length).toBeGreaterThan(0);
          for (const paragraph of section.paragraphs) {
            expect(paragraph.length).toBeGreaterThan(0);
          }
        }
      }
    },
  );

  it.each([answers, emptyAnswers])(
    // The critical invariant generate-legal-documents.use-case.ts depends
    // on: buildLegalPageContent's fieldValuesFor only works (never
    // silently returns null) when it/en produce the identical
    // section/paragraph shape. If a template edit ever breaks this
    // symmetry, a non-default locale would silently keep the default
    // locale's text instead of failing loudly — this test is the guard
    // against that.
    'it and en produce the exact same section/paragraph shape, so fieldValuesFor never returns null',
    (input) => {
      const itOutline = template.it(input);
      const enOutline = template.en(input);
      const { fieldValuesFor } = buildLegalPageContent(
        itOutline,
        DRAFT_NOTICE_TEXT.it,
      );

      const overlay = fieldValuesFor(enOutline, DRAFT_NOTICE_TEXT.en);

      expect(overlay).not.toBeNull();
    },
  );
});
