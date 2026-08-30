import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { StyleView } from '../app/style-view';
import { siteQueryOptions } from '../app/site-queries';
import { requireAuth } from './-require-auth';

const DEFAULT_SITE_ID = import.meta.env['VITE_DEFAULT_SITE_ID'] as string;

export const Route = createFileRoute('/_shell/style/')({
  loader: ({ context }) =>
    requireAuth(() =>
      context.queryClient.ensureQueryData(siteQueryOptions(DEFAULT_SITE_ID)),
    ),
  component: StyleRoute,
});

function StyleRoute() {
  const { data: site } = useSuspenseQuery(siteQueryOptions(DEFAULT_SITE_ID));

  return <StyleView siteId={DEFAULT_SITE_ID} site={site} />;
}
