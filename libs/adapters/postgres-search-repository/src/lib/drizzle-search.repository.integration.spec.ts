import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Page } from '@brisk/domain-core';
import {
  type BriskDb,
  createAppDb,
  deleteIntegrationTenants,
  pages,
  sites,
  tenants,
  withTenant,
} from '@brisk/postgres-db';
import { DrizzleSearchRepository } from './drizzle-search.repository.js';

/**
 * Runs against a real Postgres — see docs/development.md. Connects as
 * `brisk_app`, same as production code, so this also regression-tests RLS
 * isolation for `pages.search_vector` (the generated column
 * drizzle/0017_pages_search_vector.sql adds).
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

  async function insertPage(overrides: {
    tenantId: string;
    siteId: string;
    locale?: string;
    slug?: string;
    status?: 'draft' | 'published';
  }): Promise<Page> {
    const slug = overrides.slug ?? `pagina-${randomUUID()}`;
    const seoMeta = {
      title: 'Idraulico a Roma',
      description: 'Servizio urgente',
    };
    const publishedContent = [
      {
        type: 'Hero',
        props: {
          title: 'Riparazioni idrauliche',
          subtitle: 'interventi rapidi',
        },
      },
    ];

    const [row] = await withTenant(db, overrides.tenantId, (tx) =>
      tx
        .insert(pages)
        .values({
          tenantId: overrides.tenantId,
          siteId: overrides.siteId,
          groupId: randomUUID(),
          locale: overrides.locale ?? 'it',
          slug,
          status: overrides.status ?? 'published',
          content: publishedContent,
          publishedContent:
            (overrides.status ?? 'published') === 'published'
              ? publishedContent
              : null,
          seoMeta,
        })
        .returning(),
    );

    return Page.fromProps({
      id: row.id,
      tenantId: row.tenantId,
      siteId: row.siteId,
      groupId: row.groupId,
      locale: row.locale,
      slug: row.slug,
      parentId: row.parentId,
      status: row.status as 'draft' | 'published',
      content: row.content,
      publishedContent: row.publishedContent,
      seoMeta: row.seoMeta,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  it('indexes a published page and finds it by a stemmed query', async () => {
    const page = await insertPage({ tenantId: tenantAId, siteId: siteAId });
    await searchRepository.indexPage(tenantAId, siteAId, page);

    const results = await searchRepository.search(
      tenantAId,
      siteAId,
      'it',
      'idraulici',
    );

    expect(results).toHaveLength(1);
    expect(results[0].pageId).toBe(page.id);
    expect(results[0].slug).toBe(page.slug);
    expect(results[0].title).toBe('Idraulico a Roma');
    expect(results[0].excerpt.length).toBeGreaterThan(0);
    // The match markers (see the repository's own comment on why they're
    // plain control chars, not literal <mark> tags) must survive the round
    // trip through Postgres and the postgres-js driver intact.
    expect(results[0].excerpt).toContain('\x01');
    expect(results[0].excerpt).toContain('\x02');
  });

  it('never returns a draft page, even if indexed', async () => {
    const page = await insertPage({
      tenantId: tenantAId,
      siteId: siteAId,
      status: 'draft',
    });
    await searchRepository.indexPage(tenantAId, siteAId, page);

    const results = await searchRepository.search(
      tenantAId,
      siteAId,
      'it',
      'idraulici',
    );

    expect(results.find((r) => r.pageId === page.id)).toBeUndefined();
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
    const page = await insertPage({
      tenantId: tenantAId,
      siteId: otherSite.id,
    });
    await searchRepository.indexPage(tenantAId, otherSite.id, page);

    const results = await searchRepository.search(
      tenantAId,
      siteAId,
      'it',
      'idraulici',
    );

    expect(results.find((r) => r.pageId === page.id)).toBeUndefined();
  });

  it('scopes results to the given locale', async () => {
    const page = await insertPage({
      tenantId: tenantAId,
      siteId: siteAId,
      locale: 'en',
    });
    await searchRepository.indexPage(tenantAId, siteAId, page);

    const results = await searchRepository.search(
      tenantAId,
      siteAId,
      'it',
      'idraulici',
    );

    expect(results.find((r) => r.pageId === page.id)).toBeUndefined();
  });

  it('never returns a page from another tenant (RLS)', async () => {
    const [siteB] = await withTenant(db, tenantBId, (tx) =>
      tx
        .insert(sites)
        .values({ tenantId: tenantBId, name: 'Site B', defaultLocale: 'it' })
        .returning({ id: sites.id }),
    );
    const page = await insertPage({ tenantId: tenantBId, siteId: siteB.id });
    await searchRepository.indexPage(tenantBId, siteB.id, page);

    const results = await searchRepository.search(
      tenantAId,
      siteAId,
      'it',
      'idraulici',
    );

    expect(results.find((r) => r.pageId === page.id)).toBeUndefined();
  });
});
