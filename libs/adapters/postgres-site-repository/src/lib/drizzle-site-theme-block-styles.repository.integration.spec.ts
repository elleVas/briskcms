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
import { DrizzleSiteThemeBlockStylesRepository } from './drizzle-site-theme-block-styles.repository';

/** Runs against a real Postgres — see docs/development.md. */
describe('DrizzleSiteThemeBlockStylesRepository (integration)', () => {
  let db: BriskDb;
  let repository: DrizzleSiteThemeBlockStylesRepository;
  let tenantAId: string;
  let siteId: string;

  beforeAll(async () => {
    db = createAppDb();
    repository = new DrizzleSiteThemeBlockStylesRepository(db);

    const [tenantA] = await db
      .insert(tenants)
      .values({ name: `Integration Tenant A ${randomUUID()}` })
      .returning({ id: tenants.id });
    tenantAId = tenantA.id;

    const [site] = await withTenant(db, tenantAId, (tx) =>
      tx
        .insert(sites)
        .values({
          tenantId: tenantAId,
          name: 'Site for theme block styles',
          defaultLocale: 'it',
        })
        .returning({ id: sites.id }),
    );
    siteId = site.id;
  });

  afterAll(async () => {
    await deleteIntegrationTenants(db, [tenantAId]);
    await db.$client.end();
  });

  it('listBySite returns an empty map for a site with no customized block type', async () => {
    expect(await repository.listBySite(tenantAId, randomUUID())).toEqual({});
  });

  it('upsert then listBySite round-trips the style for a block type', async () => {
    await repository.upsert(tenantAId, siteId, 'Button', {
      base: { borderRadius: '9999px' },
    });

    expect(await repository.listBySite(tenantAId, siteId)).toEqual({
      Button: { base: { borderRadius: '9999px' } },
    });
  });

  it('upsert on an already-styled type replaces that row, not a field-by-field merge', async () => {
    await repository.upsert(tenantAId, siteId, 'Banner', {
      base: { borderRadius: '6px', paddingX: '1rem' },
    });

    await repository.upsert(tenantAId, siteId, 'Banner', {
      base: { borderRadius: '9999px' },
    });

    const result = await repository.listBySite(tenantAId, siteId);
    expect(result['Banner']).toEqual({ base: { borderRadius: '9999px' } });
  });

  it(
    'two concurrent upserts to DIFFERENT block types both survive (row-per-' +
      'type means no shared-row lost-update window)',
    async () => {
      await Promise.all([
        repository.upsert(tenantAId, siteId, 'Hero', {
          base: { textColor: '#ffffff' },
        }),
        repository.upsert(tenantAId, siteId, 'Feature', {
          base: { backgroundColor: '#000000' },
        }),
      ]);

      const result = await repository.listBySite(tenantAId, siteId);
      expect(result['Hero']).toEqual({ base: { textColor: '#ffffff' } });
      expect(result['Feature']).toEqual({
        base: { backgroundColor: '#000000' },
      });
    },
  );
});
