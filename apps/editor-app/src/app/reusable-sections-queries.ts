import { queryOptions } from '@tanstack/react-query';
import type { Block } from '@brisk/shared-types';
import {
  getReusableSection,
  listReusableSections,
  listVersions,
  type ReusableSectionListItemDto,
} from '../lib/reusable-sections-api-client';

export const reusableSectionsQueryKey = (siteId: string) =>
  ['reusable-sections', siteId] as const;

export function reusableSectionsQueryOptions(siteId: string) {
  return queryOptions({
    queryKey: reusableSectionsQueryKey(siteId),
    queryFn: () => listReusableSections(siteId),
  });
}

export type PublishedTemplate = ReusableSectionListItemDto & {
  publishedContent: Block[];
};

function isPublishedTemplate(
  section: ReusableSectionListItemDto,
): section is PublishedTemplate {
  return section.kind === 'template' && section.publishedContent !== null;
}

/**
 * The templates something can be started from — a page, or a strip of
 * one (docs/adr/0059, docs/adr/0072). Published only: what a template
 * hands out is what its author signed off on, and the server refuses a
 * draft anyway. The same cached list as the sections screen, narrowed, so
 * a template saved from a page appears everywhere at once.
 */
export function publishedTemplatesQueryOptions(siteId: string) {
  return queryOptions({
    ...reusableSectionsQueryOptions(siteId),
    select: (sections: ReusableSectionListItemDto[]) =>
      sections.filter(isPublishedTemplate),
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
