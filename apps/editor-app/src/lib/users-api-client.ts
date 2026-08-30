import { request } from './http-client';

export type UserRole = 'admin' | 'publisher' | 'editor';

export interface UserDto {
  id: string;
  tenantId: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  isActive: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface PaginatedUsers {
  items: UserDto[];
  total: number;
}

export function listUsers(
  page: number,
  pageSize: number,
): Promise<PaginatedUsers> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return request(`/users?${params.toString()}`);
}

export interface InviteUserInput {
  email: string;
  displayName: string;
  role: UserRole;
}

export function inviteUser(input: InviteUserInput): Promise<UserDto> {
  return request('/users/invite', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateUserRole(id: string, role: UserRole): Promise<UserDto> {
  return request(`/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function setUserActive(id: string, isActive: boolean): Promise<UserDto> {
  return request(`/users/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}
