import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type BriskDb, createAppDb } from './client';
import {
  deleteIntegrationFixtures,
  deleteIntegrationTenants,
} from './integration-test-cleanup';
import { sites, tenants, users } from './schema';
import { withTenant } from './client';

/** Runs against a real Postgres — see docs/development.md. */
describe('integration-test-cleanup (integration)', () => {
  let db: BriskDb;

  beforeAll(() => {
    db = createAppDb();
  });

  afterAll(async () => {
    await db.$client.end();
  });

  it('deleteIntegrationTenants cascades away everything under the given tenants', async () => {
    const [tenant] = await db
      .insert(tenants)
      .values({ name: `Cleanup Test Tenant ${randomUUID()}` })
      .returning({ id: tenants.id });
    await withTenant(db, tenant.id, (tx) =>
      tx.insert(sites).values({
        tenantId: tenant.id,
        name: 'Throwaway site',
        defaultLocale: 'it',
      }),
    );

    await deleteIntegrationTenants(db, [tenant.id]);

    const remaining = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenant.id));
    expect(remaining).toHaveLength(0);
  });

  it('deleteIntegrationTenants is a no-op for an empty list', async () => {
    await expect(deleteIntegrationTenants(db, [])).resolves.toBeUndefined();
  });

  it('deleteIntegrationFixtures deletes only the given site/user ids, scoped to the tenant', async () => {
    const tenantId = process.env.DEFAULT_TENANT_ID as string;
    const [site] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(sites)
        .values({
          tenantId,
          name: `Cleanup Test Site ${randomUUID()}`,
          defaultLocale: 'it',
        })
        .returning({ id: sites.id }),
    );
    const [user] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(users)
        .values({
          tenantId,
          email: `cleanup-test-${randomUUID()}@example.test`,
          passwordHash: 'irrelevant',
          role: 'admin',
        })
        .returning({ id: users.id }),
    );

    await deleteIntegrationFixtures(db, tenantId, {
      siteIds: [site.id],
      userIds: [user.id],
    });

    const [remainingSite, remainingUser] = await Promise.all([
      withTenant(db, tenantId, (tx) =>
        tx.select().from(sites).where(eq(sites.id, site.id)),
      ),
      withTenant(db, tenantId, (tx) =>
        tx.select().from(users).where(eq(users.id, user.id)),
      ),
    ]);
    expect(remainingSite).toHaveLength(0);
    expect(remainingUser).toHaveLength(0);
  });

  it('deleteIntegrationFixtures is a no-op when both id lists are empty', async () => {
    const tenantId = process.env.DEFAULT_TENANT_ID as string;
    await expect(
      deleteIntegrationFixtures(db, tenantId, {}),
    ).resolves.toBeUndefined();
  });
});
