import type { AuthenticatedRequest } from './session-auth.guard';
import { SessionTenantContextAdapter } from './session-tenant-context.adapter';

describe('SessionTenantContextAdapter', () => {
  it('reads the tenantId the guard attached to the request', () => {
    const request = { tenantId: 'tenant-1' } as AuthenticatedRequest;
    const adapter = new SessionTenantContextAdapter(request);

    expect(adapter.getCurrentTenantId()).toBe('tenant-1');
  });
});
