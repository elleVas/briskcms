import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { pagesQueryOptions } from '../app/pages-queries.js';
import { PagesListView } from '../app/pages-list-view.js';
import { siteQueryOptions } from '../app/site-queries.js';
import { requireAuth } from './-require-auth.js';

const DEFAULT_SITE_ID = import.meta.env['VITE_DEFAULT_SITE_ID'] as string;

// .default(1) keeps `page` optional for every <Link to="/pages"> that
// doesn't care what page it lands on (TanStack Router requires a search
// param at the type level unless the schema marks it optional/defaulted);
// .catch(1) on top covers a garbled value (?page=abc, ?page=-5) the same
// way, not just a missing one.
const pagesListSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export const Route = createFileRoute('/_shell/pages/')({
  validateSearch: pagesListSearchSchema,
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ context, deps }) =>
    requireAuth(() =>
      Promise.all([
        context.queryClient.ensureQueryData(
          pagesQueryOptions(DEFAULT_SITE_ID, deps.page),
        ),
        context.queryClient.ensureQueryData(siteQueryOptions(DEFAULT_SITE_ID)),
      ]),
    ),
  component: PagesListRoute,
});

function PagesListRoute() {
  const { page } = Route.useSearch();
  const { data } = useSuspenseQuery(pagesQueryOptions(DEFAULT_SITE_ID, page));
  const { data: site } = useSuspenseQuery(siteQueryOptions(DEFAULT_SITE_ID));

  return (
    <PagesListView
      siteId={DEFAULT_SITE_ID}
      defaultLocale={site.defaultLocale}
      pages={data.items}
      page={page}
      total={data.total}
    />
  );
}
