import { queryOptions } from '@tanstack/react-query';
import {
  getReusableSection,
  listReusableSections,
  listVersions,
} from '../lib/reusable-sections-api-client';

export function reusableSectionsQueryOptions(siteId: string) {
  return queryOptions({
    queryKey: ['reusable-sections', siteId] as const,
    queryFn: () => listReusableSections(siteId),
  });
}

export function reusableSectionQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['reusable-sections', 'detail', id] as const,
    queryFn: () => getReusableSection(id),
  });
}

export function reusableSectionVersionsQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['reusable-sections', 'versions', id] as const,
    queryFn: () => listVersions(id),
  });
}
