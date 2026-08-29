import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { type BriskDb, createAppDb, withTenant } from './client.js';
import { deleteIntegrationTenants } from './integration-test-cleanup.js';
import { sites, tenants } from './schema.js';

/**
 * Runs against a real Postgres — see docs/development.md ("docker compose up
 * -d postgres" + run migrations first). Exercises the actual
 * set_config()/RLS wiring that DrizzlePageRepository's integration test
 * relies on, but in isolation from any repository code.
 */
describe('withTenant (integration)', () => {
  let db: BriskDb;
  const createdTenantIds: string[] = [];

  beforeAll(() => {
    db = createAppDb();
  });

  afterAll(async () => {
    await deleteIntegrationTenants(db, createdTenantIds);
    await db.$client.end();
  });

  it('scopes app.current_tenant_id to the transaction', async () => {
    const tenantId = randomUUID();

    const [{ value }] = await withTenant(db, tenantId, (tx) =>
      tx.execute(
        sql`select current_setting('app.current_tenant_id', true) as value`,
      ),
    );
    expect(value).toBe(tenantId);

    // outside withTenant, the setting must not leak to later transactions
    const [{ value: afterValue }] = await db.execute(
      sql`select current_setting('app.current_tenant_id', true) as value`,
    );
    expect(afterValue).not.toBe(tenantId);
  });

  it('rows inserted under one tenant are invisible under another (RLS)', async () => {
    // tenants itself carries no RLS policy (see drizzle/0000_baseline_schema.sql
    // — it lists tenants, not tenant-owned data), so exercise the policy via
    // `sites`, which does.
    const [tenantA] = await db
      .insert(tenants)
      .values({ name: `Tenant A ${randomUUID()}` })
      .returning({ id: tenants.id });
    const [tenantB] = await db
      .insert(tenants)
      .values({ name: `Tenant B ${randomUUID()}` })
      .returning({ id: tenants.id });
    createdTenantIds.push(tenantA.id, tenantB.id);

    await withTenant(db, tenantA.id, (tx) =>
      tx
        .insert(sites)
        .values({ tenantId: tenantA.id, name: 'Site A', defaultLocale: 'it' }),
    );

    const visibleToA = await withTenant(db, tenantA.id, (tx) =>
      tx
        .select()
        .from(sites)
        .where(sql`${sites.tenantId} = ${tenantA.id}`),
    );
    expect(visibleToA).toHaveLength(1);

    const visibleToB = await withTenant(db, tenantB.id, (tx) =>
      tx
        .select()
        .from(sites)
        .where(sql`${sites.tenantId} = ${tenantA.id}`),
    );
    expect(visibleToB).toHaveLength(0);
  });
});
