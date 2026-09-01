import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { dashboardStatsQueryOptions } from '../app/dashboard-queries';
import { DashboardView } from '../app/dashboard-view';
import { requireAuth } from './-require-auth';

const DEFAULT_SITE_ID = import.meta.env['VITE_DEFAULT_SITE_ID'] as string;

export const Route = createFileRoute('/_shell/')({
  loader: ({ context }) =>
    requireAuth(() =>
      context.queryClient.ensureQueryData(
        dashboardStatsQueryOptions(DEFAULT_SITE_ID),
      ),
    ),
  component: DashboardRoute,
});

function DashboardRoute() {
  const { data: stats } = useSuspenseQuery(
    dashboardStatsQueryOptions(DEFAULT_SITE_ID),
  );
  return <DashboardView stats={stats} />;
}
