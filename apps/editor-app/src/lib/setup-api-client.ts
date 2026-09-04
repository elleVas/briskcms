import { request } from './http-client';

export interface SetupStatus {
  hasBeenSetUp: boolean;
}

export interface BootstrapDeploymentRequest {
  siteName: string;
  defaultLocale: string;
  adminEmail: string;
  adminPassword: string;
}

/**
 * Both endpoints are unauthenticated — they are what runs before anyone
 * can be authenticated. They still go through `request()` like everything
 * else: the timeout and the ApiError shape matter more here than anywhere,
 * because this is the first thing a self-hoster ever sees and an API that
 * is up but unreachable has to read as such rather than hanging.
 */
export function fetchSetupStatus(): Promise<SetupStatus> {
  return request<SetupStatus>('/setup/status');
}

export function bootstrapDeployment(
  body: BootstrapDeploymentRequest,
): Promise<{ tenantId: string; siteId: string; userId: string }> {
  return request('/setup', { method: 'POST', body: JSON.stringify(body) });
}
