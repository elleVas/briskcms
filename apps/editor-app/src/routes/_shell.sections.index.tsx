import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { SectionsListView } from '../app/sections-list-view';
import { siteQueryOptions } from '../app/site-queries';
import { reusableSectionsQueryOptions } from '../app/reusable-sections-queries';
import { requireAuth } from './-require-auth';

export const Route = createFileRoute('/_shell/sections/')({
  loader: ({ context }) =>
    requireAuth(async () => {
      const site =
        await context.queryClient.ensureQueryData(siteQueryOptions());
      await context.queryClient.ensureQueryData(
        reusableSectionsQueryOptions(site.id),
      );
    }),
  component: SectionsRoute,
});

function SectionsRoute() {
  const { data: site } = useSuspenseQuery(siteQueryOptions());
  return <SectionsListView siteId={site.id} />;
}
