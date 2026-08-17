import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Page } from '@brisk/domain-core';
import {
  type BriskDb,
  createDb,
  sites,
  tenants,
  withTenant,
} from '@brisk/postgres-db';
import { DrizzlePageRepository } from './drizzle-page.repository.js';
import { DrizzlePageVersionRepository } from './drizzle-page-version.repository.js';

/**
 * Runs against a real Postgres — see docs/development.md ("docker compose up
 * -d postgres" + run migrations first). Connects as `brisk_app`, same as
 * production code, so this is also the RLS regression test: any change that
 * accidentally weakens tenant isolation should fail here, not in production.
 */
describe('DrizzlePageRepository (integration)', () => {
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = process.env.POSTGRES_PORT ?? '5432';
  const database = process.env.POSTGRES_DB ?? 'brisk';
  const appPassword = process.env.POSTGRES_APP_PASSWORD ?? 'changeme_app';
  const connectionString = `postgres://brisk_app:${appPassword}@${host}:${port}/${database}`;

  let db: BriskDb;
  let pageRepository: DrizzlePageRepository;
  let pageVersionRepository: DrizzlePageVersionRepository;
  let tenantAId: string;
  let tenantBId: string;
  let siteAId: string;

  beforeAll(async () => {
    db = createDb(connectionString);
    pageRepository = new DrizzlePageRepository(db);
    pageVersionRepository = new DrizzlePageVersionRepository(db);

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
    await db.$client.end();
  });

  function buildPage(
    overrides: Partial<Parameters<typeof Page.create>[0]> = {},
  ) {
    return Page.create({
      id: randomUUID(),
      tenantId: tenantAId,
      siteId: siteAId,
      groupId: randomUUID(),
      locale: 'it',
      slug: `page-${randomUUID()}`,
      seoMeta: { title: 'Title', description: 'Description' },
      ...overrides,
    });
  }

  it('saves and retrieves a page by id, scoped to its tenant', async () => {
    const page = buildPage({
      content: [{ type: 'Hero', props: { title: 'Ciao' } }],
    });
    await pageRepository.save(page);

    const found = await pageRepository.findById(tenantAId, page.id);
    expect(found?.id).toBe(page.id);
    expect(found?.content).toEqual([
      { type: 'Hero', props: { title: 'Ciao' } },
    ]);

    const foundFromOtherTenant = await pageRepository.findById(
      tenantBId,
      page.id,
    );
    expect(foundFromOtherTenant).toBeNull();
  });

  it('findBySlug scopes by tenant, site, locale and slug', async () => {
    const page = buildPage();
    await pageRepository.save(page);

    const found = await pageRepository.findBySlug(
      tenantAId,
      siteAId,
      page.locale,
      page.slug,
    );
    expect(found?.id).toBe(page.id);

    const foundFromOtherTenant = await pageRepository.findBySlug(
      tenantBId,
      siteAId,
      page.locale,
      page.slug,
    );
    expect(foundFromOtherTenant).toBeNull();
  });

  it('save() upserts: a second save updates the same row instead of inserting a new one', async () => {
    const page = buildPage();
    await pageRepository.save(page);

    page.saveDraft([{ type: 'Text', props: { body: 'updated' } }]);
    await pageRepository.save(page);

    const found = await pageRepository.findById(tenantAId, page.id);
    expect(found?.content).toEqual([
      { type: 'Text', props: { body: 'updated' } },
    ]);
  });

  it('deletes a page scoped to its tenant', async () => {
    const page = buildPage();
    await pageRepository.save(page);

    await pageRepository.delete(tenantAId, page.id);

    expect(await pageRepository.findById(tenantAId, page.id)).toBeNull();
  });

  it('saves and lists page versions oldest-first, scoped to tenant', async () => {
    const page = buildPage();
    await pageRepository.save(page);

    const versionOneId = randomUUID();
    await pageVersionRepository.save({
      id: versionOneId,
      tenantId: tenantAId,
      pageId: page.id,
      content: [{ type: 'Hero', props: { title: 'v1' } }],
      createdBy: null,
      createdAt: new Date(Date.now() - 1000),
    });
    const versionTwoId = randomUUID();
    await pageVersionRepository.save({
      id: versionTwoId,
      tenantId: tenantAId,
      pageId: page.id,
      content: [{ type: 'Hero', props: { title: 'v2' } }],
      createdBy: null,
      createdAt: new Date(),
    });

    const versions = await pageVersionRepository.listByPage(tenantAId, page.id);
    expect(versions.map((v) => v.id)).toEqual([versionOneId, versionTwoId]);

    const versionsFromOtherTenant = await pageVersionRepository.listByPage(
      tenantBId,
      page.id,
    );
    expect(versionsFromOtherTenant).toHaveLength(0);
  });
});
