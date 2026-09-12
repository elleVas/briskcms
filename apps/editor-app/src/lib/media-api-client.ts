import { request } from './http-client';

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

/** What the library is narrowed to — see the same type on the server side for why the database answers it rather than the client. */
export interface MediaFilters {
  /** Part of a filename. */
  search?: string;
  kind?: 'image' | 'video' | 'audio';
}

export function listMedia(
  siteId: string,
  page: number,
  pageSize: number,
  filters: MediaFilters = {},
): Promise<PaginatedMedia> {
  const params = new URLSearchParams({
    siteId,
    page: String(page),
    pageSize: String(pageSize),
  });
  // Left out entirely rather than sent empty: an empty `search` would be a
  // filter the server has to decide to ignore.
  if (filters.search) {
    params.set('search', filters.search);
  }
  if (filters.kind) {
    params.set('kind', filters.kind);
  }
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
