import { queryOptions } from '@tanstack/react-query';
import { getSite } from '../lib/sites-api-client';

export function siteQueryOptions(siteId: string) {
  return queryOptions({
    queryKey: ['sites', siteId] as const,
    queryFn: () => getSite(siteId),
  });
}
