import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { IntegrationsView } from '../app/integrations-view';
import { siteQueryOptions } from '../app/site-queries';
import { requireAuth } from './-require-auth';

export const Route = createFileRoute('/_shell/integrations/')({
  loader: ({ context }) =>
    requireAuth(() => context.queryClient.ensureQueryData(siteQueryOptions())),
  component: IntegrationsRoute,
});

function IntegrationsRoute() {
  const { data: site } = useSuspenseQuery(siteQueryOptions());

  return <IntegrationsView siteId={site.id} site={site} />;
}
