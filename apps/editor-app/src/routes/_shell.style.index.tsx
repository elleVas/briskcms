import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { StyleView } from '../app/style-view';
import { siteQueryOptions } from '../app/site-queries';
import { requireAuth } from './-require-auth';

export const Route = createFileRoute('/_shell/style/')({
  loader: ({ context }) =>
    requireAuth(() => context.queryClient.ensureQueryData(siteQueryOptions())),
  component: StyleRoute,
});

function StyleRoute() {
  const { data: site } = useSuspenseQuery(siteQueryOptions());

  return <StyleView siteId={site.id} site={site} />;
}
