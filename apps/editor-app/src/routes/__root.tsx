import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { RouteError } from '../app/route-error.js';
import { RoutePending } from '../app/route-pending.js';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
