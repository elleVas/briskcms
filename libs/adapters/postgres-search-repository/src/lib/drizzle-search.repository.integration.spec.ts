import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PageTranslation } from '@brisk/domain-core';
import {
  type BriskDb,
  createAppDb,
  deleteIntegrationTenants,
  pageGroups,
  pageTranslations,
  sites,
  tenants,
  withTenant,
} from '@brisk/postgres-db';
import { DrizzleSearchRepository } from './drizzle-search.repository';

/**
 * Runs against a real Postgres — see docs/development.md. Connects as
 * `brisk_app`, same as production code, so this also regression-tests RLS
 * isolation for `page_translations.search_vector` (the generated column
 * the Fase 5 migration adds).
 */
describe('DrizzleSearchRepository (integration)', () => {
  let db: BriskDb;
  let searchRepository: DrizzleSearchRepository;
  let tenantAId: string;
  let tenantBId: string;
  let siteAId: string;

  beforeAll(async () => {
    db = createAppDb();
    searchRepository = new DrizzleSearchRepository(db);

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

    const [siteA] = await withTenant(db, tenantAId, (tx) =>
      tx
        .insert(sites)
        .values({ tenantId: tenantAId, name: 'Site A', defaultLocale: 'it' })
        .returning({ id: sites.id }),
    );
    siteAId = siteA.id;
  });

  afterAll(async () => {
    await deleteIntegrationTenants(db, [tenantAId, tenantBId]);
    await db.$client.end();
  });

  async function insertTranslation(overrides: {
    tenantId: string;
    siteId: string;
    locale?: string;
    slug?: string;
    status?: 'draft' | 'published';
  }): Promise<PageTranslation> {
    const slug = overrides.slug ?? `pagina-${randomUUID()}`;
    const seoMeta = {
      title: 'Idraulico a Roma',
      description: 'Servizio urgente',
    };
    const publishedSnapshot = [
      {
        type: 'Hero',
        props: {
          title: 'Riparazioni idrauliche',
          subtitle: 'interventi rapidi',
        },
      },
    ];

    const [group] = await withTenant(db, overrides.tenantId, (tx) =>
      tx
        .insert(pageGroups)
        .values({ tenantId: overrides.tenantId, siteId: overrides.siteId })
        .returning({ id: pageGroups.id }),
    );

    const [row] = await withTenant(db, overrides.tenantId, (tx) =>
      tx
        .insert(pageTranslations)
        .values({
          tenantId: overrides.tenantId,
          siteId: overrides.siteId,
          pageGroupId: group.id,
          locale: overrides.locale ?? 'it',
          slug,
          status: overrides.status ?? 'published',
          publishedSnapshot:
            (overrides.status ?? 'published') === 'published'
              ? publishedSnapshot
              : null,
          seoMeta,
        })
        .returning(),
    );

    return PageTranslation.fromProps({
      id: row.id,
      tenantId: row.tenantId,
      siteId: row.siteId,
      pageGroupId: row.pageGroupId,
      locale: row.locale,
      slug: row.slug,
      seoMeta: row.seoMeta,
      fieldValues: row.fieldValues,
      status: row.status as 'draft' | 'published',
      publishedSnapshot: row.publishedSnapshot,
      isDiverged: row.isDiverged,
      divergedContent: row.divergedContent,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  it('indexes a published translation and finds it by a stemmed query', async () => {
    const translation = await insertTranslation({
      tenantId: tenantAId,
      siteId: siteAId,
    });
    await searchRepository.indexPage(tenantAId, siteAId, translation);

    const results = await searchRepository.search(
      tenantAId,
      siteAId,
      'it',
      'idraulici',
    );

    expect(results).toHaveLength(1);
    expect(results[0].pageId).toBe(translation.id);
    expect(results[0].slug).toBe(translation.slug);
    expect(results[0].title).toBe('Idraulico a Roma');
    expect(results[0].excerpt.length).toBeGreaterThan(0);
    // The match markers (see the repository's own comment on why they're
    // plain control chars, not literal <mark> tags) must survive the round
    // trip through Postgres and the postgres-js driver intact.
    expect(results[0].excerpt).toContain('\x01');
    expect(results[0].excerpt).toContain('\x02');
  });

  it('never returns a draft translation, even if indexed', async () => {
    const translation = await insertTranslation({
      tenantId: tenantAId,
      siteId: siteAId,
      status: 'draft',
    });
    await searchRepository.indexPage(tenantAId, siteAId, translation);

    const results = await searchRepository.search(
      tenantAId,
      siteAId,
      'it',
      'idraulici',
    );

    expect(results.find((r) => r.pageId === translation.id)).toBeUndefined();
  });

  it('scopes results to the given site', async () => {
    const [otherSite] = await withTenant(db, tenantAId, (tx) =>
      tx
        .insert(sites)
        .values({
          tenantId: tenantAId,
          name: 'Other Site',
          defaultLocale: 'it',
        })
        .returning({ id: sites.id }),
    );
    const translation = await insertTranslation({
      tenantId: tenantAId,
      siteId: otherSite.id,
    });
    await searchRepository.indexPage(tenantAId, otherSite.id, translation);

    const results = await searchRepository.search(
      tenantAId,
      siteAId,
      'it',
      'idraulici',
    );

    expect(results.find((r) => r.pageId === translation.id)).toBeUndefined();
  });

  it('scopes results to the given locale', async () => {
    const translation = await insertTranslation({
      tenantId: tenantAId,
      siteId: siteAId,
      locale: 'en',
    });
    await searchRepository.indexPage(tenantAId, siteAId, translation);

    const results = await searchRepository.search(
      tenantAId,
      siteAId,
      'it',
      'idraulici',
    );

    expect(results.find((r) => r.pageId === translation.id)).toBeUndefined();
  });

  it('never returns a translation from another tenant (RLS)', async () => {
    const [siteB] = await withTenant(db, tenantBId, (tx) =>
      tx
        .insert(sites)
        .values({ tenantId: tenantBId, name: 'Site B', defaultLocale: 'it' })
        .returning({ id: sites.id }),
    );
    const translation = await insertTranslation({
      tenantId: tenantBId,
      siteId: siteB.id,
    });
    await searchRepository.indexPage(tenantBId, siteB.id, translation);

    const results = await searchRepository.search(
      tenantAId,
      siteAId,
      'it',
      'idraulici',
    );

    expect(results.find((r) => r.pageId === translation.id)).toBeUndefined();
  });
});
