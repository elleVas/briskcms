import { request } from './http-client.js';

export interface MediaDto {
  id: string;
  tenantId: string;
  siteId: string;
  filename: string;
  storageKey: string;
  storageProvider: 'local' | 's3';
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  url: string;
}

export interface PaginatedMedia {
  items: MediaDto[];
  total: number;
}

export function listMedia(
  siteId: string,
  page: number,
  pageSize: number,
): Promise<PaginatedMedia> {
  const params = new URLSearchParams({
    siteId,
    page: String(page),
    pageSize: String(pageSize),
  });
  return request(`/media?${params.toString()}`);
}

export function uploadMedia(siteId: string, file: File): Promise<MediaDto> {
  const body = new FormData();
  body.append('siteId', siteId);
  body.append('file', file);
  return request('/media', { method: 'POST', body });
}

export function deleteMedia(id: string): Promise<void> {
  return request(`/media/${id}`, { method: 'DELETE' });
}
