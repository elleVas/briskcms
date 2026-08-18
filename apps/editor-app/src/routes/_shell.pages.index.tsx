import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { pagesQueryOptions } from '../app/pages-queries.js';
import { PagesListView } from '../app/pages-list-view.js';
import { requireAuth } from './-require-auth.js';

const DEFAULT_SITE_ID = import.meta.env['VITE_DEFAULT_SITE_ID'] as string;

export const Route = createFileRoute('/_shell/pages/')({
  loader: ({ context }) =>
    requireAuth(() =>
      context.queryClient.ensureQueryData(pagesQueryOptions(DEFAULT_SITE_ID)),
    ),
  component: PagesListRoute,
});

function PagesListRoute() {
  const { data: pages } = useSuspenseQuery(pagesQueryOptions(DEFAULT_SITE_ID));
  return <PagesListView siteId={DEFAULT_SITE_ID} pages={pages} />;
}
