import { createFileRoute } from '@tanstack/react-router';
import { ImportView } from '../app/import-view';
import { siteQueryOptions } from '../app/site-queries';
import { requireAuth } from './-require-auth';

export const Route = createFileRoute('/_shell/imports/')({
  loader: ({ context }) =>
    requireAuth(() => context.queryClient.ensureQueryData(siteQueryOptions())),
  component: ImportRoute,
});

function ImportRoute() {
  const site = Route.useLoaderData();
  return <ImportView siteId={site.id} />;
}
