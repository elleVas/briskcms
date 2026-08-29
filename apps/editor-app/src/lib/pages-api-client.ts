import {
  pageRecordSchema,
  pageVersionRecordSchema,
  paginatedPagesSchema,
  type Block,
  type PageListItem,
  type PageRecord,
  type PageVersionRecord,
  type PaginatedPages,
  type SeoMeta,
} from '@brisk/shared-types';
import { request } from './http-client.js';

export type { PageListItem, PageRecord, PageVersionRecord, PaginatedPages };

async function requestPage(
  path: string,
  init?: RequestInit,
): Promise<PageRecord> {
  return pageRecordSchema.parse(await request(path, init));
}

export function getPage(id: string): Promise<PageRecord> {
  return requestPage(`/pages/${id}`);
}

export async function listPages(
  siteId: string,
  page: number,
  pageSize: number,
): Promise<PaginatedPages> {
  const params = new URLSearchParams({
    siteId,
    page: String(page),
    pageSize: String(pageSize),
  });
  return paginatedPagesSchema.parse(
    await request(`/pages?${params.toString()}`),
  );
}

export interface CreatePageInput {
  siteId: string;
  groupId: string;
  locale: string;
  slug: string;
  parentId?: string | null;
  seoMeta: SeoMeta;
}

export function createPage(input: CreatePageInput): Promise<PageRecord> {
  return requestPage('/pages', { method: 'POST', body: JSON.stringify(input) });
}

export function setPageParent(
  id: string,
  parentId: string | null,
): Promise<PageRecord> {
  return requestPage(`/pages/${id}/parent`, {
    method: 'PATCH',
    body: JSON.stringify({ parentId }),
  });
}

export function saveDraft(id: string, content: Block[]): Promise<PageRecord> {
  return requestPage(`/pages/${id}/draft`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export function publishPage(id: string): Promise<PageRecord> {
  return requestPage(`/pages/${id}/publish`, { method: 'POST' });
}

export function updateSeoMeta(
  id: string,
  seoMeta: SeoMeta,
): Promise<PageRecord> {
  return requestPage(`/pages/${id}/seo`, {
    method: 'PATCH',
    body: JSON.stringify({ seoMeta }),
  });
}

export function deletePage(id: string): Promise<void> {
  return request(`/pages/${id}`, { method: 'DELETE' });
}

export interface DuplicatePageInput {
  slug: string;
  title: string;
  description: string;
}

export function duplicatePage(
  id: string,
  input: DuplicatePageInput,
): Promise<PageRecord> {
  return requestPage(`/pages/${id}/duplicate`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listPageVersions(
  pageId: string,
): Promise<PageVersionRecord[]> {
  const versions = await request(`/pages/${pageId}/versions`);
  return pageVersionRecordSchema.array().parse(versions);
}

export function rollbackToVersion(
  pageId: string,
  versionId: string,
): Promise<PageRecord> {
  return requestPage(`/pages/${pageId}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ versionId }),
  });
}

// Every group sibling, including the page itself (docs/adr/0017) — the
// caller (PageTranslationsDialog) needs "am I already in the list" to
// decide which of the site's enabledLocales still have no translation.
export async function listTranslations(pageId: string): Promise<PageRecord[]> {
  const pages = await request(`/pages/${pageId}/translations`);
  return pageRecordSchema.array().parse(pages);
}

export interface CreateTranslationInput {
  locale: string;
  slug: string;
}

export function createTranslation(
  pageId: string,
  input: CreateTranslationInput,
): Promise<PageRecord> {
  return requestPage(`/pages/${pageId}/translations`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// See use-page-translations.ts: `structureSignature` is always the
// default-locale sibling's CURRENT signature, computed client-side from
// the same translations list the drift badge itself is derived from.
export function markTranslationSynced(
  pageId: string,
  structureSignature: string,
): Promise<PageRecord> {
  return requestPage(`/pages/${pageId}/mark-translation-synced`, {
    method: 'PATCH',
    body: JSON.stringify({ structureSignature }),
  });
}
