import { request } from './http-client';

// Mirrors apps/api/.../legal-documents.schemas.ts's own wire contract — kept
// as a separate client-side shape rather than importing from `@brisk/application`
// (a backend-only layer), same convention as every other *-api-client.ts DTO
// in this app.
export const LEGAL_DOCUMENT_KINDS = [
  'privacy-policy',
  'cookie-policy',
  'terms-conditions',
] as const;
export type LegalDocumentKind = (typeof LEGAL_DOCUMENT_KINDS)[number];

export interface LegalDocumentAnswers {
  legalEntityName: string;
  contactEmail: string;
  address: string | null;
  phone: string | null;
  vatId: string | null;
  domain: string | null;
  dataCollected: {
    contactForm: boolean;
    newsletter: boolean;
    accounts: boolean;
  };
  thirdPartyServices: string[];
  retentionDays: number | null;
  jurisdictionCountry: string;
}

export interface GenerateLegalDocumentsInput {
  documents: LegalDocumentKind[];
  locales: string[];
  answers: LegalDocumentAnswers;
}

export interface GeneratedLegalDocumentTranslation {
  locale: string;
  translationId: string;
  slug: string;
}

export interface GeneratedLegalDocument {
  kind: LegalDocumentKind;
  pageGroupId: string;
  translations: GeneratedLegalDocumentTranslation[];
}

export interface GenerateLegalDocumentsResponse {
  documents: GeneratedLegalDocument[];
}

export interface LegalDocumentPreviewSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocumentPreviewOutline {
  title: string;
  sections: LegalDocumentPreviewSection[];
}

export interface PreviewLegalDocumentsResponse {
  documents: Array<{
    kind: LegalDocumentKind;
    locales: Record<string, LegalDocumentPreviewOutline>;
  }>;
}

export function generateLegalDocuments(
  siteId: string,
  input: GenerateLegalDocumentsInput,
): Promise<GenerateLegalDocumentsResponse> {
  return request(`/sites/${siteId}/legal-documents`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function previewLegalDocuments(
  siteId: string,
  input: GenerateLegalDocumentsInput,
): Promise<PreviewLegalDocumentsResponse> {
  return request(`/sites/${siteId}/legal-documents/preview`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
