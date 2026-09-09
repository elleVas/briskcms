import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { TaxonomiesView } from '../app/taxonomies-view';
import { siteQueryOptions } from '../app/site-queries';
import { taxonomiesQueryOptions } from '../app/taxonomies-queries';
import { requireAuth } from './-require-auth';

export const Route = createFileRoute('/_shell/taxonomies/')({
  loader: ({ context }) =>
    requireAuth(async () => {
      const site =
        await context.queryClient.ensureQueryData(siteQueryOptions());
      await context.queryClient.ensureQueryData(
        taxonomiesQueryOptions(site.id),
      );
    }),
  component: TaxonomiesRoute,
});

function TaxonomiesRoute() {
  const { data: site } = useSuspenseQuery(siteQueryOptions());
  return <TaxonomiesView siteId={site.id} />;
}
