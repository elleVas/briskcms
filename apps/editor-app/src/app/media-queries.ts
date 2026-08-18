import { queryOptions } from '@tanstack/react-query';
import { listMedia } from '../lib/media-api-client.js';

export const MEDIA_PAGE_SIZE = 24;

export function mediaQueryOptions(siteId: string, page: number) {
  return queryOptions({
    queryKey: ['media', siteId, page, MEDIA_PAGE_SIZE] as const,
    queryFn: () => listMedia(siteId, page, MEDIA_PAGE_SIZE),
  });
}
