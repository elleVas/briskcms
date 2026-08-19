import type { Block, SeoMeta } from '@brisk/shared-types';
import { request } from './http-client.js';

export interface PageDto {
  id: string;
  tenantId: string;
  siteId: string;
  groupId: string;
  locale: string;
  slug: string;
  parentId: string | null;
  status: 'draft' | 'published';
  content: Block[];
  publishedContent: Block[] | null;
  seoMeta: SeoMeta;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedPages {
  items: PageDto[];
  total: number;
}

export function getPage(id: string): Promise<PageDto> {
  return request(`/pages/${id}`);
}

export function listPages(
  siteId: string,
  page: number,
  pageSize: number,
): Promise<PaginatedPages> {
  const params = new URLSearchParams({
    siteId,
    page: String(page),
    pageSize: String(pageSize),
  });
  return request(`/pages?${params.toString()}`);
}

export interface CreatePageInput {
  siteId: string;
  groupId: string;
  locale: string;
  slug: string;
  parentId?: string | null;
  seoMeta: SeoMeta;
}

export function createPage(input: CreatePageInput): Promise<PageDto> {
  return request('/pages', { method: 'POST', body: JSON.stringify(input) });
}

export function setPageParent(
  id: string,
  parentId: string | null,
): Promise<PageDto> {
  return request(`/pages/${id}/parent`, {
    method: 'PATCH',
    body: JSON.stringify({ parentId }),
  });
}

export function saveDraft(id: string, content: Block[]): Promise<PageDto> {
  return request(`/pages/${id}/draft`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export function publishPage(id: string): Promise<PageDto> {
  return request(`/pages/${id}/publish`, { method: 'POST' });
}

export function updateSeoMeta(id: string, seoMeta: SeoMeta): Promise<PageDto> {
  return request(`/pages/${id}/seo`, {
    method: 'PATCH',
    body: JSON.stringify({ seoMeta }),
  });
}

export function deletePage(id: string): Promise<void> {
  return request(`/pages/${id}`, { method: 'DELETE' });
}

export interface PageVersionDto {
  id: string;
  tenantId: string;
  pageId: string;
  content: Block[];
  createdBy: string | null;
  createdAt: string;
}

export function listPageVersions(pageId: string): Promise<PageVersionDto[]> {
  return request(`/pages/${pageId}/versions`);
}

export function rollbackToVersion(
  pageId: string,
  versionId: string,
): Promise<PageDto> {
  return request(`/pages/${pageId}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ versionId }),
  });
}

// Every group sibling, including the page itself (docs/adr/0017) — the
// caller (PageTranslationsDialog) needs "am I already in the list" to
// decide which of the site's enabledLocales still have no translation.
export function listTranslations(pageId: string): Promise<PageDto[]> {
  return request(`/pages/${pageId}/translations`);
}

export interface CreateTranslationInput {
  locale: string;
  slug: string;
}

export function createTranslation(
  pageId: string,
  input: CreateTranslationInput,
): Promise<PageDto> {
  return request(`/pages/${pageId}/translations`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
