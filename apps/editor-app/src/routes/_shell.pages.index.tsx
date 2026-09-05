import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { z } from 'zod';
import type { ListPageGroupsFilters } from '../lib/page-groups-api-client';
import { pageGroupsQueryOptions } from '../app/page-groups-queries';
import { PageGroupsListView } from '../app/page-groups-list-view';
import {
  EMPTY_PAGES_LIST_FILTERS,
  type PagesListFilterValues,
} from '../app/pages-list-filter-bar';
import { siteQueryOptions } from '../app/site-queries';
import { useDebouncedValue } from '../app/use-debounced-value';
import { requireAuth } from './-require-auth';

// .default(1) keeps `page` optional for every <Link to="/pages"> that
// doesn't care what page it lands on (TanStack Router requires a search
// param at the type level unless the schema marks it optional/defaulted);
// .catch(1) on top covers a garbled value (?page=abc, ?page=-5) the same
// way, not just a missing one. Filters themselves are deliberately NOT
// URL-synced (see PagesListRoute's own comment) — only pagination is.
const pagesListSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export const Route = createFileRoute('/_shell/pages/')({
  validateSearch: pagesListSearchSchema,
  loaderDeps: ({ search }) => ({ page: search.page }),
  // Sequential rather than the Promise.all this used to be: the site's id
  // is what scopes the list, so it has to be resolved before the list can
  // be asked for at all.
  loader: ({ context, deps }) =>
    requireAuth(async () => {
      const site =
        await context.queryClient.ensureQueryData(siteQueryOptions());
      // Warms only the unfiltered page-1(+N)-equivalent fetch (no
      // filters applied yet at first paint) — once the user actually
      // touches the filter bar, the component below refetches via a
      // plain (non-suspense) useQuery instead, see its own comment.
      await context.queryClient.ensureQueryData(
        pageGroupsQueryOptions(site.id, deps.page),
      );
    }),
  component: PagesListRoute,
});

function toApiFilters(
  filters: PagesListFilterValues,
  debouncedSearch: string,
): ListPageGroupsFilters {
  return {
    search: debouncedSearch || undefined,
    createdAfter: filters.createdAfter
      ? new Date(filters.createdAfter)
      : undefined,
    createdBefore: filters.createdBefore
      ? new Date(filters.createdBefore)
      : undefined,
    createdBy: filters.createdBy || undefined,
    locale: filters.locale || undefined,
  };
}

function PagesListRoute() {
  const { page } = Route.useSearch();
  const { data: site } = useSuspenseQuery(siteQueryOptions());
  // Local, not URL-synced (unlike `page`): the filter bar's own text input
  // needs to update on every keystroke, and syncing that straight into the
  // route search params would mean a full loader re-run (and, worse, a
  // Suspense re-render blanking the whole list including the input itself)
  // on every character typed. Only the SEARCH text is debounced before it
  // reaches the query — the other filters are discrete selections
  // (date/creator/locale), not typed text, so there's nothing to debounce
  // there.
  const [filters, setFilters] = useState(EMPTY_PAGES_LIST_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search, 300);

  // A plain (non-suspense) query, not useSuspenseQuery like the initial
  // loader fetch above: filtering/paginating after the first paint must
  // update in place, not blank the screen back to a Suspense fallback.
  // `placeholderData: keepPreviousData` keeps the OLD rows on screen
  // (with `isFetching` true) while a new filter combination loads, instead
  // of flashing empty.
  const { data } = useQuery({
    ...pageGroupsQueryOptions(
      site.id,
      page,
      toApiFilters(filters, debouncedSearch),
    ),
    placeholderData: keepPreviousData,
  });

  return (
    <PageGroupsListView
      siteId={site.id}
      defaultLocale={site.defaultLocale}
      enabledLocales={site.enabledLocales}
      groups={data?.items ?? []}
      page={page}
      total={data?.total ?? 0}
      filters={filters}
      onFiltersChange={setFilters}
    />
  );
}
