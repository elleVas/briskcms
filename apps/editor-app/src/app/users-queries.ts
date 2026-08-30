import { queryOptions } from '@tanstack/react-query';
import { listUsers } from '../lib/users-api-client';

export const USERS_PAGE_SIZE = 20;

export function usersQueryOptions(page: number) {
  return queryOptions({
    queryKey: ['users', page, USERS_PAGE_SIZE] as const,
    queryFn: () => listUsers(page, USERS_PAGE_SIZE),
  });
}
