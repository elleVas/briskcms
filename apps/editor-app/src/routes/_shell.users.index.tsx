import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { usersQueryOptions } from '../app/users-queries.js';
import { UsersListView } from '../app/users-list-view.js';
import { requireAuth } from './-require-auth.js';

// Same reasoning as pagesListSearchSchema/mediaListSearchSchema: keeps
// `page` optional at the type level for every plain <Link to="/users">
// and falls back cleanly on a garbled value (?page=abc).
const usersListSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export const Route = createFileRoute('/_shell/users/')({
  validateSearch: usersListSearchSchema,
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ context, deps }) =>
    requireAuth(() =>
      context.queryClient.ensureQueryData(usersQueryOptions(deps.page)),
    ),
  component: UsersListRoute,
});

function UsersListRoute() {
  const { page } = Route.useSearch();
  const { data } = useSuspenseQuery(usersQueryOptions(page));

  return <UsersListView items={data.items} page={page} total={data.total} />;
}
