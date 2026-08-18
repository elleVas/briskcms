import { queryOptions } from '@tanstack/react-query';
import { getPage, listPages } from '../lib/pages-api-client.js';

export function pagesQueryOptions(siteId: string) {
  return queryOptions({
    queryKey: ['pages', siteId] as const,
    queryFn: () => listPages(siteId),
  });
}

export function pageQueryOptions(pageId: string) {
  return queryOptions({
    queryKey: ['pages', 'detail', pageId] as const,
    queryFn: () => getPage(pageId),
  });
}
