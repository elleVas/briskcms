import { queryOptions } from '@tanstack/react-query';
import { getSite, listAvailableThemes } from '../lib/sites-api-client';

export function siteQueryOptions(siteId: string) {
  return queryOptions({
    queryKey: ['sites', siteId] as const,
    queryFn: () => getSite(siteId),
  });
}

// Which themes this deployment actually bundled (docs/adr/0042) — same
// image for the life of a running container, so this never needs
// invalidating once fetched.
export function availableThemesQueryOptions() {
  return queryOptions({
    queryKey: ['sites', 'themes', 'available'] as const,
    queryFn: () => listAvailableThemes(),
    staleTime: Infinity,
  });
}
