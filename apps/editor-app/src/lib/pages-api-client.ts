import type { Block, SeoMeta } from '@brisk/shared-types';
import { request } from './http-client.js';

export interface PageDto {
  id: string;
  tenantId: string;
  siteId: string;
  groupId: string;
  locale: string;
  slug: string;
  status: 'draft' | 'published';
  content: Block[];
  publishedContent: Block[] | null;
  seoMeta: SeoMeta;
  createdAt: string;
  updatedAt: string;
}

export function getPage(id: string): Promise<PageDto> {
  return request(`/pages/${id}`);
}

export function listPages(siteId: string): Promise<PageDto[]> {
  return request(`/pages?siteId=${encodeURIComponent(siteId)}`);
}

export interface CreatePageInput {
  siteId: string;
  groupId: string;
  locale: string;
  slug: string;
  seoMeta: SeoMeta;
}

export function createPage(input: CreatePageInput): Promise<PageDto> {
  return request('/pages', { method: 'POST', body: JSON.stringify(input) });
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
