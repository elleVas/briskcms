import {
  paginatedPageGroupsSchema,
  pageGroupRecordSchema,
  pageGroupVersionRecordSchema,
  pageTranslationRecordSchema,
  pageTranslationVersionRecordSchema,
  type Block,
  type FieldValueOverlay,
  type PageGroupListItemRecord,
  type PageGroupRecord,
  type PageGroupVersionRecord,
  type PageTranslationRecord,
  type PageTranslationVersionRecord,
  type PaginatedPageGroups,
  type SeoMeta,
} from '@brisk/shared-types';
import { request } from './http-client';

export type {
  PageGroupListItemRecord,
  PageGroupRecord,
  PageGroupVersionRecord,
  PageTranslationRecord,
  PageTranslationVersionRecord,
  PaginatedPageGroups,
};

async function requestGroup(
  path: string,
  init?: RequestInit,
): Promise<PageGroupRecord> {
  return pageGroupRecordSchema.parse(await request(path, init));
}

async function requestTranslation(
  path: string,
  init?: RequestInit,
): Promise<PageTranslationRecord> {
  return pageTranslationRecordSchema.parse(await request(path, init));
}

export function getPageGroup(id: string): Promise<PageGroupRecord> {
  return requestGroup(`/page-groups/${id}`);
}

export interface CreatePageGroupInput {
  siteId: string;
  parentId?: string | null;
  content?: Block[];
}

export function createPageGroup(
  input: CreatePageGroupInput,
): Promise<PageGroupRecord> {
  return requestGroup('/page-groups', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface ListPageGroupsFilters {
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  createdBy?: string;
  locale?: string;
}

export async function listPageGroups(
  siteId: string,
  page: number,
  pageSize: number,
  filters: ListPageGroupsFilters = {},
): Promise<PaginatedPageGroups> {
  const params = new URLSearchParams({
    siteId,
    page: String(page),
    pageSize: String(pageSize),
  });
  if (filters.search) params.set('search', filters.search);
  if (filters.createdAfter) {
    params.set('createdAfter', filters.createdAfter.toISOString());
  }
  if (filters.createdBefore) {
    params.set('createdBefore', filters.createdBefore.toISOString());
  }
  if (filters.createdBy) params.set('createdBy', filters.createdBy);
  if (filters.locale) params.set('locale', filters.locale);
  return paginatedPageGroupsSchema.parse(
    await request(`/page-groups?${params.toString()}`),
  );
}

export function savePageGroupContent(
  id: string,
  content: Block[],
): Promise<PageGroupRecord> {
  return requestGroup(`/page-groups/${id}/content`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export function deletePageGroup(id: string): Promise<void> {
  return request(`/page-groups/${id}`, { method: 'DELETE' });
}

export function reorderPageGroups(
  siteId: string,
  parentId: string | null,
  orderedPageGroupIds: string[],
): Promise<void> {
  return request('/page-groups/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ siteId, parentId, orderedPageGroupIds }),
  });
}

export function duplicatePageGroup(id: string): Promise<PageGroupRecord> {
  return requestGroup(`/page-groups/${id}/duplicate`, { method: 'POST' });
}

export function rollbackPageGroupToVersion(
  id: string,
  versionId: string,
): Promise<PageGroupRecord> {
  return requestGroup(`/page-groups/${id}/rollback`, {
    method: 'PATCH',
    body: JSON.stringify({ versionId }),
  });
}

export async function listPageGroupVersions(
  groupId: string,
): Promise<PageGroupVersionRecord[]> {
  const versions = await request(`/page-groups/${groupId}/versions`);
  return pageGroupVersionRecordSchema.array().parse(versions);
}

export async function listPageGroupTranslations(
  groupId: string,
): Promise<PageTranslationRecord[]> {
  const translations = await request(`/page-groups/${groupId}/translations`);
  return pageTranslationRecordSchema.array().parse(translations);
}

export interface CreatePageGroupTranslationInput {
  locale: string;
  slug: string;
  seoMeta: SeoMeta;
}

export function createPageGroupTranslation(
  groupId: string,
  input: CreatePageGroupTranslationInput,
): Promise<PageTranslationRecord> {
  return requestTranslation(`/page-groups/${groupId}/translations`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function savePageTranslationFieldValues(
  translationId: string,
  fieldValues: FieldValueOverlay,
  parentGroupId: string | null,
): Promise<PageTranslationRecord> {
  return requestTranslation(
    `/page-groups/translations/${translationId}/field-values`,
    {
      method: 'PATCH',
      body: JSON.stringify({ fieldValues, parentGroupId }),
    },
  );
}

export function saveDivergedPageTranslationContent(
  translationId: string,
  content: Block[],
  parentGroupId: string | null,
): Promise<PageTranslationRecord> {
  return requestTranslation(
    `/page-groups/translations/${translationId}/diverged-content`,
    {
      method: 'PATCH',
      body: JSON.stringify({ content, parentGroupId }),
    },
  );
}

export function updatePageTranslationSeoMeta(
  translationId: string,
  seoMeta: SeoMeta,
  parentGroupId: string | null,
): Promise<PageTranslationRecord> {
  return requestTranslation(`/page-groups/translations/${translationId}/seo`, {
    method: 'PATCH',
    body: JSON.stringify({ seoMeta, parentGroupId }),
  });
}

export function publishPageTranslation(
  translationId: string,
): Promise<PageTranslationRecord> {
  return requestTranslation(
    `/page-groups/translations/${translationId}/publish`,
    { method: 'POST' },
  );
}

export function divergePageTranslation(
  translationId: string,
): Promise<PageTranslationRecord> {
  return requestTranslation(
    `/page-groups/translations/${translationId}/diverge`,
    { method: 'POST' },
  );
}

export async function listPageTranslationVersions(
  translationId: string,
): Promise<PageTranslationVersionRecord[]> {
  const versions = await request(
    `/page-groups/translations/${translationId}/versions`,
  );
  return pageTranslationVersionRecordSchema.array().parse(versions);
}
