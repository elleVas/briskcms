import { queryOptions } from '@tanstack/react-query';
import { listTaxonomies, listTerms } from '../lib/taxonomies-api-client';

export function taxonomiesQueryOptions(siteId: string) {
  return queryOptions({
    queryKey: ['taxonomies', siteId] as const,
    queryFn: () => listTaxonomies(siteId),
  });
}

export function termsQueryOptions(taxonomyId: string) {
  return queryOptions({
    queryKey: ['taxonomies', 'terms', taxonomyId] as const,
    queryFn: () => listTerms(taxonomyId),
  });
}
