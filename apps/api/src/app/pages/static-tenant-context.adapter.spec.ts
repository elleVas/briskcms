import { StaticTenantContextAdapter } from './static-tenant-context.adapter.js';

describe('StaticTenantContextAdapter', () => {
  const originalValue = process.env.DEFAULT_TENANT_ID;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.DEFAULT_TENANT_ID;
    } else {
      process.env.DEFAULT_TENANT_ID = originalValue;
    }
  });

  it('returns DEFAULT_TENANT_ID when set', () => {
    process.env.DEFAULT_TENANT_ID = 'tenant-1';

    expect(new StaticTenantContextAdapter().getCurrentTenantId()).toBe(
      'tenant-1',
    );
  });

  it('throws when DEFAULT_TENANT_ID is missing', () => {
    delete process.env.DEFAULT_TENANT_ID;

    expect(() => new StaticTenantContextAdapter().getCurrentTenantId()).toThrow(
      /Missing DEFAULT_TENANT_ID/,
    );
  });
});
