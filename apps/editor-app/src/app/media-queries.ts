import { queryOptions } from '@tanstack/react-query';
import { listMedia, type MediaFilters } from '../lib/media-api-client';

export const MEDIA_PAGE_SIZE = 24;

export function mediaQueryOptions(
  siteId: string,
  page: number,
  filters: MediaFilters = {},
) {
  return queryOptions({
    // The filters are part of the key: two searches are two different
    // lists, and sharing one cache entry would show the previous answer
    // while the next one loads.
    queryKey: [
      'media',
      siteId,
      page,
      MEDIA_PAGE_SIZE,
      filters.search ?? '',
      filters.kind ?? '',
    ] as const,
    queryFn: () => listMedia(siteId, page, MEDIA_PAGE_SIZE, filters),
  });
}
