import { createFileRoute, redirect } from '@tanstack/react-router';
import { PagesListView } from '../app/pages-list-view.js';
import { ApiError } from '../lib/http-client.js';
import { listPages } from '../lib/pages-api-client.js';

const DEFAULT_SITE_ID = import.meta.env['VITE_DEFAULT_SITE_ID'] as string;

export const Route = createFileRoute('/_shell/pages/')({
  loader: async () => {
    try {
      return await listPages(DEFAULT_SITE_ID);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw redirect({ to: '/login' });
      }
      throw error;
    }
  },
  component: PagesListRoute,
});

function PagesListRoute() {
  const pages = Route.useLoaderData();
  return <PagesListView siteId={DEFAULT_SITE_ID} pages={pages} />;
}
