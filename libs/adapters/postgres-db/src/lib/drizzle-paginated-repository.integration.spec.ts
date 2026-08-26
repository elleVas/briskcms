import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { type BriskDb, createAppDb } from './client.js';
import { deleteIntegrationTenants } from './integration-test-cleanup.js';
import { sites, tenants } from './schema.js';
import {
  DrizzlePaginatedRepository,
  type Pagination,
} from './drizzle-paginated-repository.js';

interface TestSite {
  id: string;
  tenantId: string;
  name: string;
}

/**
 * Runs against a real Postgres, same as this project's other
 * `.integration.spec.ts` files. Exercises `DrizzlePaginatedRepository`
 * itself: the 5 concrete repositories that extend it (page/user/media/
 * form/site-layout-section, security review 2026-08-24 point 9) each live
 * in their own Nx project and only cover this base class transitively,
 * through their own domain-specific tests. Reuses `sites` purely as
 * backing storage for a minimal test entity — `DrizzleSiteRepository`
 * itself is tested elsewhere, this is only about the shared mechanism.
 */
class TestSitesRepository extends DrizzlePaginatedRepository<
  typeof sites.$inferSelect,
  TestSite,
  typeof sites.$inferInsert
> {
  constructor(db: BriskDb) {
    super(db);
  }

  protected readonly table = sites;
  protected readonly idColumn = sites.id;
  protected readonly tenantIdColumn = sites.tenantId;

  protected toRow(entity: TestSite): typeof sites.$inferInsert {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      defaultLocale: 'it',
    };
  }

  protected fromRow(row: typeof sites.$inferSelect): TestSite {
    return { id: row.id, tenantId: row.tenantId, name: row.name };
  }

  async listPaginated(tenantId: string, pagination: Pagination) {
    return this.listPaginatedTx(
      tenantId,
      eq(this.tenantIdColumn, tenantId),
      sites.createdAt,
      pagination,
    );
  }
}

describe('DrizzlePaginatedRepository (integration)', () => {
  let db: BriskDb;
  let repo: TestSitesRepository;
  const createdTenantIds: string[] = [];

  beforeAll(() => {
    db = createAppDb();
    repo = new TestSitesRepository(db);
  });

  afterAll(async () => {
    await deleteIntegrationTenants(db, createdTenantIds);
    await db.$client.end();
  });

  async function createTenant(label: string): Promise<string> {
    const [tenant] = await db
      .insert(tenants)
      .values({ name: `${label} ${randomUUID()}` })
      .returning({ id: tenants.id });
    createdTenantIds.push(tenant.id);
    return tenant.id;
  }

  it('save() inserts a new row, findById() reads it back', async () => {
    const tenantId = await createTenant('save-insert');
    const id = randomUUID();

    await repo.save({ id, tenantId, name: 'First name' });

    expect(await repo.findById(tenantId, id)).toEqual({
      id,
      tenantId,
      name: 'First name',
    });
  });

  it('save() on an existing id upserts instead of duplicating (onConflictDoUpdate on the PK)', async () => {
    const tenantId = await createTenant('save-upsert');
    const id = randomUUID();

    await repo.save({ id, tenantId, name: 'Original' });
    await repo.save({ id, tenantId, name: 'Updated' });

    expect((await repo.findById(tenantId, id))?.name).toBe('Updated');
  });

  it('findById() returns null when the row belongs to a different tenant (RLS-scoped)', async () => {
    const tenantAId = await createTenant('find-tenant-a');
    const tenantBId = await createTenant('find-tenant-b');
    const id = randomUUID();

    await repo.save({ id, tenantId: tenantAId, name: 'Tenant A site' });

    expect(await repo.findById(tenantBId, id)).toBeNull();
  });

  it('findById() returns null for an id that was never saved', async () => {
    const tenantId = await createTenant('find-missing');

    expect(await repo.findById(tenantId, randomUUID())).toBeNull();
  });

  it('delete() removes the row', async () => {
    const tenantId = await createTenant('delete');
    const id = randomUUID();
    await repo.save({ id, tenantId, name: 'To delete' });

    await repo.delete(tenantId, id);

    expect(await repo.findById(tenantId, id)).toBeNull();
  });

  it('listPaginated() returns items most-recent-first, scoped to the tenant, with the total across all pages', async () => {
    const tenantId = await createTenant('list-paginate');
    const otherTenantId = await createTenant('list-other');
    await repo.save({
      id: randomUUID(),
      tenantId: otherTenantId,
      name: 'Not mine',
    });

    for (const name of ['First', 'Second', 'Third']) {
      await repo.save({ id: randomUUID(), tenantId, name });
      // createdAt has second-level-ish resolution under load; force a
      // strict ordering between the three inserts.
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    const page1 = await repo.listPaginated(tenantId, { page: 1, pageSize: 2 });
    expect(page1.total).toBe(3);
    expect(page1.items.map((s) => s.name)).toEqual(['Third', 'Second']);

    const page2 = await repo.listPaginated(tenantId, { page: 2, pageSize: 2 });
    expect(page2.total).toBe(3);
    expect(page2.items.map((s) => s.name)).toEqual(['First']);
  });
});
