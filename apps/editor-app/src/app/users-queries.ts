import { queryOptions } from '@tanstack/react-query';
import { listUsers } from '../lib/users-api-client';

export const USERS_PAGE_SIZE = 20;

export function usersQueryOptions(page: number) {
  return queryOptions({
    queryKey: ['users', page, USERS_PAGE_SIZE] as const,
    queryFn: () => listUsers(page, USERS_PAGE_SIZE),
  });
}

// A single page, generously sized — for a compact picker (the pages-list
// filter bar's "creator" dropdown), not a paginated list view. `listUsers`
// has no `search` param (same gap as listPages), so this fetches
// everyone and lets the caller filter client-side — same "at the 5-15
// scale this product assumes" reasoning as page-list-provider.tsx's own
// locale filter.
const ALL_USERS_PAGE_SIZE = 200;

export function allUsersQueryOptions() {
  return queryOptions({
    queryKey: ['users', 'all', ALL_USERS_PAGE_SIZE] as const,
    queryFn: () => listUsers(1, ALL_USERS_PAGE_SIZE),
  });
}
