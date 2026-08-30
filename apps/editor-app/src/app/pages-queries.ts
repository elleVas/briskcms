import { queryOptions } from '@tanstack/react-query';
import {
  getPage,
  listPages,
  listPageVersions,
  listTranslations,
} from '../lib/pages-api-client';

export const PAGES_PAGE_SIZE = 20;

export function pagesQueryOptions(siteId: string, page: number) {
  return queryOptions({
    queryKey: ['pages', siteId, page, PAGES_PAGE_SIZE] as const,
    queryFn: () => listPages(siteId, page, PAGES_PAGE_SIZE),
  });
}

export function pageQueryOptions(pageId: string) {
  return queryOptions({
    queryKey: ['pages', 'detail', pageId] as const,
    queryFn: () => getPage(pageId),
  });
}

export function pageVersionsQueryOptions(pageId: string) {
  return queryOptions({
    queryKey: ['pages', 'versions', pageId] as const,
    queryFn: () => listPageVersions(pageId),
  });
}

export function pageTranslationsQueryOptions(pageId: string) {
  return queryOptions({
    queryKey: ['pages', 'translations', pageId] as const,
    queryFn: () => listTranslations(pageId),
  });
}
