import {
  type MediaKind,
  type MediaKindCounts,
  type MediaRecord,
  type PaginatedMedia,
  mediaKindCountsSchema,
  mediaRecordSchema,
  paginatedMediaSchema,
} from '@brisk/shared-types';
import { request } from './http-client';

export type { MediaKindCounts, MediaRecord, PaginatedMedia };

/** What the library is narrowed to — see the same type on the server side for why the database answers it rather than the client. */
export interface MediaFilters {
  /** Part of a filename. */
  search?: string;
  kind?: MediaKind;
}

/** How many files each of the library's folders holds. */
export async function countMediaByKind(
  siteId: string,
): Promise<MediaKindCounts> {
  const params = new URLSearchParams({ siteId });
  return mediaKindCountsSchema.parse(
    await request(`/media/kinds?${params.toString()}`),
  );
}

export async function listMedia(
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
  return paginatedMediaSchema.parse(
    await request(`/media?${params.toString()}`),
  );
}

export async function uploadMedia(
  siteId: string,
  file: File,
): Promise<MediaRecord> {
  const body = new FormData();
  body.append('siteId', siteId);
  body.append('file', file);
  return mediaRecordSchema.parse(
    await request('/media', { method: 'POST', body }),
  );
}

export function deleteMedia(id: string): Promise<void> {
  return request(`/media/${id}`, { method: 'DELETE' });
}
