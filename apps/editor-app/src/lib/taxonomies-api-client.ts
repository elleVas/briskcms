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

export interface CreateTaxonomyInput {
  siteId: string;
  name: LocalizedText;
  /**
   * Absent = derive one from the name, `null` = mount the terms at the
   * site root. Three states, and the API can only tell them apart if the
   * key is genuinely absent — see the ADR-0064 note on the body schema.
   */
  prefix?: string | null;
  hierarchical?: boolean;
}

export function createTaxonomy(
  input: CreateTaxonomyInput,
): Promise<TaxonomyDto> {
  return request('/taxonomies', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface UpdateTaxonomyInput {
  name?: LocalizedText;
  prefix?: string | null;
  hierarchical?: boolean;
}

export function updateTaxonomy(
  id: string,
  input: UpdateTaxonomyInput,
): Promise<TaxonomyDto> {
  return request(`/taxonomies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTaxonomy(id: string): Promise<{ ok: true }> {
  return request(`/taxonomies/${id}`, { method: 'DELETE' });
}

export interface CreateTermInput {
  name: LocalizedText;
  slugs?: Record<string, string>;
  parentId?: string | null;
}

export function createTerm(
  taxonomyId: string,
  input: CreateTermInput,
): Promise<TermDto> {
  return request(`/taxonomies/${taxonomyId}/terms`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface UpdateTermInput {
  name?: LocalizedText;
  description?: LocalizedText;
  /** Replaces the whole map: a language left out loses its address. */
  slugs?: Record<string, string>;
  landingPageGroupId?: string | null;
}

export function updateTerm(
  termId: string,
  input: UpdateTermInput,
): Promise<TermDto> {
  return request(`/taxonomies/terms/${termId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function moveTerm(
  termId: string,
  parentId: string | null,
): Promise<TermDto> {
  return request(`/taxonomies/terms/${termId}/parent`, {
    method: 'PATCH',
    body: JSON.stringify({ parentId }),
  });
}

export function deleteTerm(termId: string): Promise<{ ok: true }> {
  return request(`/taxonomies/terms/${termId}`, { method: 'DELETE' });
}

/** Which terms a page carries — on the page GROUP, so it is the same set in every language (ADR-0064). */
export function getPageGroupTerms(
  pageGroupId: string,
): Promise<{ termIds: string[] }> {
  return request(`/page-groups/${pageGroupId}/terms`);
}

export function setPageGroupTerms(
  pageGroupId: string,
  termIds: string[],
): Promise<{ termIds: string[] }> {
  return request(`/page-groups/${pageGroupId}/terms`, {
    method: 'PATCH',
    body: JSON.stringify({ termIds }),
  });
}
