import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { dashboardStatsQueryOptions } from '../app/dashboard-queries';
import { DashboardView } from '../app/dashboard-view';
import { siteQueryOptions } from '../app/site-queries';
import { requireAuth } from './-require-auth';

export const Route = createFileRoute('/_shell/')({
  // The site has to be resolved before the stats can be asked for, since
  // its id is what scopes them — one extra await, not one extra request:
  // every other screen has already put this same entry in the cache.
  loader: ({ context }) =>
    requireAuth(async () => {
      const site =
        await context.queryClient.ensureQueryData(siteQueryOptions());
      await context.queryClient.ensureQueryData(
        dashboardStatsQueryOptions(site.id),
      );
    }),
  component: DashboardRoute,
});

function DashboardRoute() {
  const { data: site } = useSuspenseQuery(siteQueryOptions());
  const { data: stats } = useSuspenseQuery(dashboardStatsQueryOptions(site.id));
  return <DashboardView stats={stats} />;
}
