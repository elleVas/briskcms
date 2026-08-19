import { request } from './http-client.js';

export function login(
  email: string,
  password: string,
): Promise<{ userId: string }> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<{ success: boolean }> {
  return request('/auth/logout', { method: 'POST' });
}

export function requestPasswordReset(
  email: string,
): Promise<{ success: boolean }> {
  return request('/auth/request-password-reset', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ success: boolean }> {
  return request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export function verifyEmail(token: string): Promise<{ success: boolean }> {
  return request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function acceptInvite(
  token: string,
  password: string,
): Promise<{ success: boolean }> {
  return request('/auth/accept-invite', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}
