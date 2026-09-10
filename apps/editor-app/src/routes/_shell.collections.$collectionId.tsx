import { useState } from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { z } from 'zod';
import { collectionsQueryOptions } from '../app/collections-queries';
import { pageGroupsQueryOptions } from '../app/page-groups-queries';
import { PageGroupsListView } from '../app/page-groups-list-view';
import { EMPTY_PAGES_LIST_FILTERS } from '../app/pages-list-filter-bar';
import { siteQueryOptions } from '../app/site-queries';
import { toApiFilters } from '../app/pages-list-filters';
import { useDebouncedValue } from '../app/use-debounced-value';
import { requireAuth } from './-require-auth';

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export const Route = createFileRoute('/_shell/collections/$collectionId')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ context, deps, params }) =>
    requireAuth(async () => {
      const site =
        await context.queryClient.ensureQueryData(siteQueryOptions());
      const collections = await context.queryClient.ensureQueryData(
        collectionsQueryOptions(site.id),
      );
      // A link to a section somebody has since deleted is a 404, not an
      // empty list pretending the section is still there.
      if (!collections.some((one) => one.id === params.collectionId)) {
        throw notFound();
      }
      await context.queryClient.ensureQueryData(
        pageGroupsQueryOptions(site.id, deps.page, {
          collection: params.collectionId,
        }),
      );
    }),
  component: CollectionRoute,
});

function CollectionRoute() {
  const { page } = Route.useSearch();
  const { collectionId } = Route.useParams();
  const { data: site } = useSuspenseQuery(siteQueryOptions());
  const { data: collections } = useSuspenseQuery(
    collectionsQueryOptions(site.id),
  );
  const collection = collections.find((one) => one.id === collectionId);

  const [filters, setFilters] = useState(EMPTY_PAGES_LIST_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search, 300);

  const { data } = useQuery({
    ...pageGroupsQueryOptions(site.id, page, {
      ...toApiFilters(filters, debouncedSearch),
      collection: collectionId,
    }),
    placeholderData: keepPreviousData,
  });

  return (
    <PageGroupsListView
      key={collectionId}
      siteId={site.id}
      layout="feed"
      collectionId={collectionId}
      title={collection?.name}
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
