import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type BriskDb,
  createAppDb,
  deleteIntegrationTenants,
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
    await deleteIntegrationTenants(db, [tenantAId, tenantBId]);
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

  it('finds a site by id, scoped to its tenant', async () => {
    const [row] = await withTenant(db, tenantAId, (tx) =>
      tx
        .insert(sites)
        .values({
          tenantId: tenantAId,
          name: 'Site by id',
          defaultLocale: 'it',
        })
        .returning({ id: sites.id }),
    );

    const found = await siteRepository.findById(tenantAId, row.id);
    expect(found?.name).toBe('Site by id');

    expect(await siteRepository.findById(tenantBId, row.id)).toBeNull();
  });

  it('save() persists business info and upserts on a second call', async () => {
    const [row] = await withTenant(db, tenantAId, (tx) =>
      tx
        .insert(sites)
        .values({
          tenantId: tenantAId,
          name: 'Site to update',
          defaultLocale: 'it',
        })
        .returning({ id: sites.id }),
    );

    const site = await siteRepository.findById(tenantAId, row.id);
    if (!site) throw new Error('expected the just-inserted site to be found');
    site.updateBusinessInfo({
      businessAddress: 'Via Roma 1, Milano',
      businessPhone: '+39 02 1234567',
      businessType: 'Restaurant',
      openingHours: [
        {
          dayOfWeek: 'monday',
          ranges: [{ opens: '12:00', closes: '15:00' }],
        },
      ],
    });
    await siteRepository.save(site);

    const updated = await siteRepository.findById(tenantAId, row.id);
    expect(updated?.businessAddress).toBe('Via Roma 1, Milano');
    expect(updated?.openingHours).toEqual([
      { dayOfWeek: 'monday', ranges: [{ opens: '12:00', closes: '15:00' }] },
    ]);
  });
});
