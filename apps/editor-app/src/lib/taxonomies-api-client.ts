import type { LocalizedText } from '@brisk/shared-types';
import { request } from './http-client';

export interface TaxonomyDto {
  id: string;
  tenantId: string;
  siteId: string;
  /** The URL prefix its terms answer under, or `null` for the site root (ADR-0064). */
  prefix: string | null;
  name: LocalizedText;
  hierarchical: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface TermDto {
  id: string;
  tenantId: string;
  siteId: string;
  taxonomyId: string;
  parentId: string | null;
  name: LocalizedText;
  description: LocalizedText;
  landingPageGroupId: string | null;
  order: number;
  /** locale -> the slug this term answers to in that language. */
  slugs: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export function listTaxonomies(siteId: string): Promise<TaxonomyDto[]> {
  const params = new URLSearchParams({ siteId });
  return request(`/taxonomies?${params.toString()}`);
}

export function listTerms(taxonomyId: string): Promise<TermDto[]> {
  return request(`/taxonomies/${taxonomyId}/terms`);
}
