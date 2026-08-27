import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Page,
  PageSlugAlreadyExistsError,
  PageTranslationAlreadyExistsError,
} from '@brisk/domain-core';
import {
  type BriskDb,
  createAppDb,
  deleteIntegrationTenants,
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
  let db: BriskDb;
  let pageRepository: DrizzlePageRepository;
  let pageVersionRepository: DrizzlePageVersionRepository;
  let tenantAId: string;
  let tenantBId: string;
  let siteAId: string;

  beforeAll(async () => {
    db = createAppDb();
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
    await deleteIntegrationTenants(db, [tenantAId, tenantBId]);
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

  // Regression: `pages` also carries `search_text` (SearchPort's own
  // column, see @brisk/postgres-search-repository) — fromRow() must not
  // leak it into the domain entity via a naive row spread, or it ends up
  // in every endpoint that returns page.toProps().
  it('never leaks the search_text column into Page.toProps()', async () => {
    const page = buildPage();
    await pageRepository.save(page);

    const found = await pageRepository.findById(tenantAId, page.id);

    expect(found?.toProps()).not.toHaveProperty('searchText');
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

  it('listBySite scopes by tenant and site, most recently updated first', async () => {
    const older = buildPage({ now: new Date(Date.now() - 1000) });
    const newer = buildPage({ now: new Date() });
    await pageRepository.save(older);
    await pageRepository.save(newer);

    const found = await pageRepository.listBySite(tenantAId, siteAId, {
      page: 1,
      pageSize: 100,
    });
    const foundIds = found.items.map((page) => page.id);
    expect(foundIds.indexOf(newer.id)).toBeLessThan(foundIds.indexOf(older.id));

    const foundFromOtherTenant = await pageRepository.listBySite(
      tenantBId,
      siteAId,
      { page: 1, pageSize: 100 },
    );
    expect(foundFromOtherTenant.items).toHaveLength(0);
    expect(foundFromOtherTenant.total).toBe(0);
  });

  it('listBySite paginates with limit/offset and reports the total', async () => {
    for (let i = 0; i < 3; i++) {
      await pageRepository.save(
        buildPage({ now: new Date(Date.now() - i * 1000) }),
      );
    }

    const firstPage = await pageRepository.listBySite(tenantAId, siteAId, {
      page: 1,
      pageSize: 2,
    });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.total).toBeGreaterThanOrEqual(3);

    const secondPage = await pageRepository.listBySite(tenantAId, siteAId, {
      page: 2,
      pageSize: 2,
    });
    const firstIds = firstPage.items.map((page) => page.id);
    const secondIds = secondPage.items.map((page) => page.id);
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
  });

  it('listBySite never ships content/publishedContent, and computes hasUnpublishedChanges server-side', async () => {
    // Security review 2026-08-24, database section: the list used to
    // return full Page entities (content/publishedContent, the entire
    // Puck block tree) just to render titles — the summary shape must
    // never carry either field, and the "pending changes" indicator the
    // editor UI shows must still work from a computed boolean instead.
    const page = buildPage({
      content: [{ type: 'Text', props: { body: 'draft' } }],
    });
    await pageRepository.save(page);

    const beforePublish = await pageRepository.listBySite(tenantAId, siteAId, {
      page: 1,
      pageSize: 100,
    });
    const draftSummary = beforePublish.items.find((p) => p.id === page.id);
    expect(draftSummary).not.toHaveProperty('content');
    expect(draftSummary).not.toHaveProperty('publishedContent');
    // Not yet published at all — never counts as "unpublished changes".
    expect(draftSummary?.hasUnpublishedChanges).toBe(false);

    page.publish();
    await pageRepository.save(page);
    const afterPublish = await pageRepository.listBySite(tenantAId, siteAId, {
      page: 1,
      pageSize: 100,
    });
    expect(
      afterPublish.items.find((p) => p.id === page.id)?.hasUnpublishedChanges,
    ).toBe(false);

    page.saveDraft([{ type: 'Text', props: { body: 'edited after publish' } }]);
    await pageRepository.save(page);
    const afterDraftEdit = await pageRepository.listBySite(tenantAId, siteAId, {
      page: 1,
      pageSize: 100,
    });
    expect(
      afterDraftEdit.items.find((p) => p.id === page.id)?.hasUnpublishedChanges,
    ).toBe(true);
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

  it('prunes down to the last 10 versions, regardless of age', async () => {
    const page = buildPage();
    await pageRepository.save(page);

    const oldestId = randomUUID();
    await pageVersionRepository.save({
      id: oldestId,
      tenantId: tenantAId,
      pageId: page.id,
      content: [{ type: 'Hero', props: { title: 'oldest' } }],
      createdBy: null,
      createdAt: new Date(Date.now() - 10 * 1000),
    });

    // 12 more saves in the same short burst — each save also runs the
    // prune, so by the time this loop finishes the two oldest versions
    // (the seed above plus the loop's own first save) are already gone,
    // even though every single one of them is only seconds old.
    let lastId = oldestId;
    for (let i = 0; i < 12; i++) {
      lastId = randomUUID();
      await pageVersionRepository.save({
        id: lastId,
        tenantId: tenantAId,
        pageId: page.id,
        content: [{ type: 'Hero', props: { title: `recent-${i}` } }],
        createdBy: null,
        createdAt: new Date(Date.now() - (11 - i) * 1000),
      });
    }

    const versions = await pageVersionRepository.listByPage(tenantAId, page.id);
    expect(versions).toHaveLength(10);
    expect(versions.map((v) => v.id)).not.toContain(oldestId);
    expect(versions.map((v) => v.id)).toContain(lastId);
  });

  it('keeps every version when there are 10 or fewer', async () => {
    const page = buildPage();
    await pageRepository.save(page);

    for (let i = 0; i < 7; i++) {
      await pageVersionRepository.save({
        id: randomUUID(),
        tenantId: tenantAId,
        pageId: page.id,
        content: [{ type: 'Hero', props: { title: `v-${i}` } }],
        createdBy: null,
        createdAt: new Date(Date.now() - (6 - i) * 1000),
      });
    }

    const versions = await pageVersionRepository.listByPage(tenantAId, page.id);
    expect(versions).toHaveLength(7);
  });

  it('listByGroup returns every locale-translation of the same page, scoped to tenant', async () => {
    const groupId = randomUUID();
    const italian = buildPage({ groupId, locale: 'it', slug: 'chi-siamo' });
    const english = buildPage({ groupId, locale: 'en', slug: 'about-us' });
    const unrelated = buildPage({ locale: 'it', slug: 'contatti' });
    await pageRepository.save(italian);
    await pageRepository.save(english);
    await pageRepository.save(unrelated);

    const found = await pageRepository.listByGroup(tenantAId, siteAId, groupId);

    expect(found.map((p) => p.locale).sort()).toEqual(['en', 'it']);

    const foundFromOtherTenant = await pageRepository.listByGroup(
      tenantBId,
      siteAId,
      groupId,
    );
    expect(foundFromOtherTenant).toHaveLength(0);
  });

  // Regression: the check-then-act in createPage/createPageTranslation isn't
  // atomic — under real concurrency the second insert must still fail with
  // the right domain error at the DB level, not a raw PostgresError. This
  // simulates the race by skipping the use-case's own check entirely and
  // saving two conflicting pages directly.
  it('save() rejects a second page with the same tenant/site/locale/slug with PageSlugAlreadyExistsError', async () => {
    const first = buildPage({ slug: 'stessa-slug' });
    await pageRepository.save(first);

    const second = buildPage({ slug: 'stessa-slug' });
    await expect(pageRepository.save(second)).rejects.toThrow(
      PageSlugAlreadyExistsError,
    );
  });

  it('save() rejects a second page in the same tenant/site/group with an already-used locale with PageTranslationAlreadyExistsError', async () => {
    const groupId = randomUUID();
    const first = buildPage({ groupId, locale: 'it' });
    await pageRepository.save(first);

    const second = buildPage({ groupId, locale: 'it' });
    await expect(pageRepository.save(second)).rejects.toThrow(
      PageTranslationAlreadyExistsError,
    );
  });

  describe('saveWithVersion', () => {
    it('saves the page and its version together', async () => {
      const page = buildPage({
        content: [{ type: 'Hero', props: { title: 'v1' } }],
      });
      const versionId = randomUUID();

      await pageRepository.saveWithVersion(page, {
        id: versionId,
        tenantId: tenantAId,
        pageId: page.id,
        content: page.content,
        createdBy: null,
        createdAt: page.updatedAt,
      });

      const foundPage = await pageRepository.findById(tenantAId, page.id);
      expect(foundPage?.id).toBe(page.id);
      const versions = await pageVersionRepository.listByPage(
        tenantAId,
        page.id,
      );
      expect(versions.map((v) => v.id)).toEqual([versionId]);
    });

    it('maps a slug conflict to PageSlugAlreadyExistsError, same as save()', async () => {
      const first = buildPage({ slug: 'stessa-slug-with-version' });
      await pageRepository.save(first);

      const second = buildPage({ slug: 'stessa-slug-with-version' });
      await expect(
        pageRepository.saveWithVersion(second, {
          id: randomUUID(),
          tenantId: tenantAId,
          pageId: second.id,
          content: second.content,
          createdBy: null,
          createdAt: second.updatedAt,
        }),
      ).rejects.toThrow(PageSlugAlreadyExistsError);
    });

    // The regression this method exists to fix: page+version must commit
    // atomically. Forced here by pointing the version at a page id that
    // doesn't exist, which trips page_versions' FK on page_id — if the two
    // writes weren't in the same transaction, the page upsert above would
    // still have committed even though the whole call rejects.
    it('rolls back the page save too when the version insert fails', async () => {
      const page = buildPage();

      await expect(
        pageRepository.saveWithVersion(page, {
          id: randomUUID(),
          tenantId: tenantAId,
          pageId: randomUUID(),
          content: page.content,
          createdBy: null,
          createdAt: page.updatedAt,
        }),
      ).rejects.toThrow();

      expect(await pageRepository.findById(tenantAId, page.id)).toBeNull();
    });
  });
});
