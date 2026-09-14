import type { AccountProfile } from '@brisk/shared-types';
import { request } from './http-client';

/** The signed-in person's own profile (docs/adr/0071). */
export function getAccountProfile(): Promise<AccountProfile> {
  return request('/account/profile');
}

export interface UpdateAccountProfileInput {
  displayName: string;
  /** `null` leaves the address as it is — or has one made from the name, for someone who has none yet. */
  slug: string | null;
  bio: Record<string, string>;
}

export function updateAccountProfile(
  input: UpdateAccountProfileInput,
): Promise<AccountProfile> {
  return request('/account/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function uploadAccountAvatar(file: File): Promise<AccountProfile> {
  const body = new FormData();
  body.append('file', file);
  return request('/account/avatar', { method: 'POST', body });
}

export function removeAccountAvatar(): Promise<AccountProfile> {
  return request('/account/avatar', { method: 'DELETE' });
}
