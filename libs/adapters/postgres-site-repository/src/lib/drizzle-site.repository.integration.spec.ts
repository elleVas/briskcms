import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type BriskDb,
  createAppDb,
  sites,
  tenants,
  withTenant,
} from '@brisk/postgres-db';
import { DrizzleSiteRepository } from './drizzle-site.repository.js';

/**
 * Runs against a real Postgres — see docs/development.md. Connects as
 * `brisk_app`, same as production code, so this is also the RLS regression
 * test for `sites`: domain lookup is the one query the public site's
 * unauthenticated rendering path relies on, so a tenant leak here would be
 * a real cross-site data exposure, not just a test failure.
 */
describe('DrizzleSiteRepository (integration)', () => {
  let db: BriskDb;
  let siteRepository: DrizzleSiteRepository;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    db = createAppDb();
    siteRepository = new DrizzleSiteRepository(db);

    const [tenantA] = await db
      .insert(tenants)
      .values({ name: `Integration Tenant A ${randomUUID()}` })
      .returning({ id: tenants.id });
    const [tenantB] = await db
      .insert(tenants)
      .values({ name: `Integration Tenant B ${randomUUID()}` })
      .returning({ id: tenants.id });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;
  });

  afterAll(async () => {
    await db.$client.end();
  });

  it('finds a site by domain, scoped to its tenant', async () => {
    const domain = `site-${randomUUID()}.example.com`;
    await withTenant(db, tenantAId, (tx) =>
      tx.insert(sites).values({
        tenantId: tenantAId,
        name: 'Site A',
        domain,
        defaultLocale: 'it',
      }),
    );

    const found = await siteRepository.findByDomain(tenantAId, domain);
    expect(found?.name).toBe('Site A');
    expect(found?.domain).toBe(domain);

    const foundFromOtherTenant = await siteRepository.findByDomain(
      tenantBId,
      domain,
    );
    expect(foundFromOtherTenant).toBeNull();
  });

  it('returns null for a domain that does not exist', async () => {
    expect(
      await siteRepository.findByDomain(tenantAId, 'nobody-has-this.test'),
    ).toBeNull();
  });
});
