import { queryOptions } from '@tanstack/react-query';
import {
  countMediaByKind,
  listMedia,
  type MediaFilters,
} from '../lib/media-api-client';

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

export function mediaKindCountsQueryOptions(siteId: string) {
  return queryOptions({
    // Under the same ['media', siteId] prefix the list uses, so an upload
    // or a delete — which invalidates that prefix — refreshes the folder
    // counts too, instead of leaving "Documents (3)" over four documents.
    queryKey: ['media', siteId, 'kinds'] as const,
    queryFn: () => countMediaByKind(siteId),
  });
}
