import type { User } from '@brisk/domain-core';
import type { PaginatedResult, UserRepositoryPort } from '@brisk/ports';

export interface ListUsersDeps {
  userRepository: UserRepositoryPort;
}

export interface ListUsersInput {
  tenantId: string;
  page: number;
  pageSize: number;
}

export function listUsers(
  deps: ListUsersDeps,
  input: ListUsersInput,
): Promise<PaginatedResult<User>> {
  return deps.userRepository.list(input.tenantId, {
    page: input.page,
    pageSize: input.pageSize,
  });
}
