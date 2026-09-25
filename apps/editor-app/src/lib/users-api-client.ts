import {
  type PaginatedUsers,
  type UserRecord,
  type UserRole,
  paginatedUsersSchema,
  userRecordSchema,
} from '@brisk/shared-types';
import { request } from './http-client';

export type { PaginatedUsers, UserRecord, UserRole };

export async function listUsers(
  page: number,
  pageSize: number,
): Promise<PaginatedUsers> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return paginatedUsersSchema.parse(
    await request(`/users?${params.toString()}`),
  );
}

export interface InviteUserInput {
  email: string;
  displayName: string;
  role: UserRole;
}

export async function inviteUser(input: InviteUserInput): Promise<UserRecord> {
  return userRecordSchema.parse(
    await request('/users/invite', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function updateUserRole(
  id: string,
  role: UserRole,
): Promise<UserRecord> {
  return userRecordSchema.parse(
    await request(`/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  );
}

export async function setUserActive(
  id: string,
  isActive: boolean,
): Promise<UserRecord> {
  return userRecordSchema.parse(
    await request(`/users/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),
  );
}
