import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { IntegrationsView } from '../app/integrations-view.js';
import { siteQueryOptions } from '../app/site-queries.js';
import { requireAuth } from './-require-auth.js';

const DEFAULT_SITE_ID = import.meta.env['VITE_DEFAULT_SITE_ID'] as string;

export const Route = createFileRoute('/_shell/integrations/')({
  loader: ({ context }) =>
    requireAuth(() =>
      context.queryClient.ensureQueryData(siteQueryOptions(DEFAULT_SITE_ID)),
    ),
  component: IntegrationsRoute,
});

function IntegrationsRoute() {
  const { data: site } = useSuspenseQuery(siteQueryOptions(DEFAULT_SITE_ID));

  return <IntegrationsView siteId={DEFAULT_SITE_ID} site={site} />;
}
