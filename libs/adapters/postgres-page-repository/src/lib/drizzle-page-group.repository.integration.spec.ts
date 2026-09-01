import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  PageGroup,
  PageSlugAlreadyExistsError,
  PageTranslation,
  PageTranslationLocaleAlreadyExistsError,
} from '@brisk/domain-core';
import {
  type BriskDb,
  createAppDb,
  deleteIntegrationTenants,
  pageGroups,
  sites,
  tenants,
  users,
  withTenant,
} from '@brisk/postgres-db';
import { DrizzlePageGroupRepository } from './drizzle-page-group.repository';
import { DrizzlePageGroupVersionRepository } from './drizzle-page-group-version.repository';
import { DrizzlePageTranslationRepository } from './drizzle-page-translation.repository';
import { DrizzlePageTranslationVersionRepository } from './drizzle-page-translation-version.repository';

/**
 * Runs against a real Postgres — see docs/development.md. Connects as
 * `brisk_app`, same as production code — this is also the RLS regression
 * test for the new i18n tables, same reasoning as
 * drizzle-page.repository.integration.spec.ts.
 */
describe('DrizzlePageGroupRepository / DrizzlePageTranslationRepository (integration)', () => {
  let db: BriskDb;
  let groupRepository: DrizzlePageGroupRepository;
  let groupVersionRepository: DrizzlePageGroupVersionRepository;
  let translationRepository: DrizzlePageTranslationRepository;
  let translationVersionRepository: DrizzlePageTranslationVersionRepository;
  let tenantAId: string;
  let tenantBId: string;
  let siteAId: string;
  let userAId: string;

  beforeAll(async () => {
    db = createAppDb();
    groupRepository = new DrizzlePageGroupRepository(db);
    groupVersionRepository = new DrizzlePageGroupVersionRepository(db);
    translationRepository = new DrizzlePageTranslationRepository(db);
    translationVersionRepository = new DrizzlePageTranslationVersionRepository(
      db,
    );

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

    const [userA] = await withTenant(db, tenantAId, (tx) =>
      tx
        .insert(users)
        .values({
          tenantId: tenantAId,
          email: `list-filter-${randomUUID()}@example.test`,
          displayName: 'Ada Lovelace',
          passwordHash: 'hash',
          role: 'admin',
        })
        .returning({ id: users.id }),
    );
    userAId = userA.id;
  });

  afterAll(async () => {
    await deleteIntegrationTenants(db, [tenantAId, tenantBId]);
    await db.$client.end();
  });

  function buildGroup(
    overrides: Partial<Parameters<typeof PageGroup.create>[0]> = {},
  ) {
    return PageGroup.create({
      id: randomUUID(),
      tenantId: tenantAId,
      siteId: siteAId,
      ...overrides,
    });
  }

  function buildTranslation(
    pageGroupId: string,
    overrides: Partial<Parameters<typeof PageTranslation.create>[0]> = {},
  ) {
    return PageTranslation.create({
      id: randomUUID(),
      tenantId: tenantAId,
      siteId: siteAId,
      pageGroupId,
      locale: 'it',
      slug: `page-${randomUUID()}`,
      seoMeta: { title: 'Title', description: 'Description' },
      ...overrides,
    });
  }

  describe('PageGroup', () => {
    it('saves and retrieves a group by id, scoped to its tenant', async () => {
      const group = buildGroup({
        content: [{ type: 'Hero', props: { title: 'Ciao' } }],
      });
      await groupRepository.save(group);

      const found = await groupRepository.findById(tenantAId, group.id);
      expect(found?.id).toBe(group.id);
      expect(found?.content).toEqual([
        { type: 'Hero', props: { title: 'Ciao' } },
      ]);

      const foundFromOtherTenant = await groupRepository.findById(
        tenantBId,
        group.id,
      );
      expect(foundFromOtherTenant).toBeNull();
    });

    it('listBySite scopes by tenant and site, ordered by sibling position then createdAt', async () => {
      const older = buildGroup({ now: new Date(Date.now() - 1000) });
      const newer = buildGroup({ now: new Date() });
      await groupRepository.save(older);
      await groupRepository.save(newer);

      const found = await groupRepository.listBySite(tenantAId, siteAId, {
        page: 1,
        pageSize: 100,
      });
      const foundIds = found.items.map((g) => g.id);
      expect(foundIds.indexOf(older.id)).toBeLessThan(
        foundIds.indexOf(newer.id),
      );

      const foundFromOtherTenant = await groupRepository.listBySite(
        tenantBId,
        siteAId,
        { page: 1, pageSize: 100 },
      );
      expect(foundFromOtherTenant.items).toHaveLength(0);
    });

    it('listSiblings scopes to one exact parentId, ordered by position', async () => {
      const root = buildGroup({});
      await groupRepository.save(root);
      const childA = buildGroup({ parentId: root.id, order: 1 });
      const childB = buildGroup({ parentId: root.id, order: 0 });
      const grandchild = buildGroup({ parentId: childA.id });
      await groupRepository.save(childA);
      await groupRepository.save(childB);
      await groupRepository.save(grandchild);

      const siblings = await groupRepository.listSiblings(
        tenantAId,
        siteAId,
        root.id,
      );
      expect(siblings.map((g) => g.id)).toEqual([childB.id, childA.id]);
    });

    it('save() upserts: a second save updates the same row instead of inserting a new one', async () => {
      const group = buildGroup();
      await groupRepository.save(group);

      group.saveContent([{ type: 'Text', props: { body: 'updated' } }]);
      await groupRepository.save(group);

      const found = await groupRepository.findById(tenantAId, group.id);
      expect(found?.content).toEqual([
        { type: 'Text', props: { body: 'updated' } },
      ]);
    });

    it('deletes a group scoped to its tenant', async () => {
      const group = buildGroup();
      await groupRepository.save(group);

      await groupRepository.delete(tenantAId, group.id);

      expect(await groupRepository.findById(tenantAId, group.id)).toBeNull();
    });

    describe('listBySiteFiltered', () => {
      it('lists a group with all its translations summarized', async () => {
        const group = buildGroup();
        await groupRepository.save(group);
        const itSlug = `chi-siamo-${randomUUID()}`;
        const enSlug = `about-us-${randomUUID()}`;
        const itTranslation = buildTranslation(group.id, {
          locale: 'it',
          slug: itSlug,
          seoMeta: { title: 'Chi siamo', description: '' },
        });
        await translationRepository.save(itTranslation, null);
        const enTranslation = buildTranslation(group.id, {
          locale: 'en',
          slug: enSlug,
          seoMeta: { title: 'About us', description: '' },
        });
        await translationRepository.save(enTranslation, null);

        const result = await groupRepository.listBySiteFiltered(
          tenantAId,
          siteAId,
          { page: 1, pageSize: 20 },
          {},
        );

        const row = result.items.find((item) => item.id === group.id);
        expect(
          row?.translations.sort((a, b) => a.locale.localeCompare(b.locale)),
        ).toEqual([
          {
            locale: 'en',
            slug: enSlug,
            title: 'About us',
            status: 'draft',
            isDiverged: false,
          },
          {
            locale: 'it',
            slug: itSlug,
            title: 'Chi siamo',
            status: 'draft',
            isDiverged: false,
          },
        ]);
      });

      it('filters by title, case-insensitively, matching any translation', async () => {
        const matching = buildGroup();
        await groupRepository.save(matching);
        await translationRepository.save(
          buildTranslation(matching.id, {
            seoMeta: { title: 'Idraulico a Roma', description: '' },
          }),
          null,
        );
        const nonMatching = buildGroup();
        await groupRepository.save(nonMatching);
        await translationRepository.save(
          buildTranslation(nonMatching.id, {
            seoMeta: { title: 'Contatti', description: '' },
          }),
          null,
        );

        const result = await groupRepository.listBySiteFiltered(
          tenantAId,
          siteAId,
          { page: 1, pageSize: 20 },
          { search: 'idraulico' },
        );

        const ids = result.items.map((item) => item.id);
        expect(ids).toContain(matching.id);
        expect(ids).not.toContain(nonMatching.id);
      });

      it('filters by locale — a group with no translation in that locale is excluded', async () => {
        const withFrench = buildGroup();
        await groupRepository.save(withFrench);
        await translationRepository.save(
          buildTranslation(withFrench.id, { locale: 'fr' }),
          null,
        );
        const withoutFrench = buildGroup();
        await groupRepository.save(withoutFrench);
        await translationRepository.save(
          buildTranslation(withoutFrench.id, { locale: 'de' }),
          null,
        );

        const result = await groupRepository.listBySiteFiltered(
          tenantAId,
          siteAId,
          { page: 1, pageSize: 20 },
          { locale: 'fr' },
        );

        const ids = result.items.map((item) => item.id);
        expect(ids).toContain(withFrench.id);
        expect(ids).not.toContain(withoutFrench.id);
      });

      it('filters by createdBy', async () => {
        const byUserA = buildGroup({ createdBy: userAId });
        await groupRepository.save(byUserA);
        const byNoOne = buildGroup({ createdBy: null });
        await groupRepository.save(byNoOne);

        const result = await groupRepository.listBySiteFiltered(
          tenantAId,
          siteAId,
          { page: 1, pageSize: 20 },
          { createdBy: userAId },
        );

        const ids = result.items.map((item) => item.id);
        expect(ids).toContain(byUserA.id);
        expect(ids).not.toContain(byNoOne.id);
        expect(
          result.items.find((item) => item.id === byUserA.id)?.createdByName,
        ).toBe('Ada Lovelace');
      });

      it('filters by a createdAt date range', async () => {
        const old = buildGroup();
        await groupRepository.save(old);
        await withTenant(db, tenantAId, (tx) =>
          tx
            .update(pageGroups)
            .set({ createdAt: new Date('2020-01-01T00:00:00Z') })
            .where(eq(pageGroups.id, old.id)),
        );
        const recent = buildGroup();
        await groupRepository.save(recent);

        const result = await groupRepository.listBySiteFiltered(
          tenantAId,
          siteAId,
          { page: 1, pageSize: 20 },
          { createdAfter: new Date('2024-01-01T00:00:00Z') },
        );

        const ids = result.items.map((item) => item.id);
        expect(ids).toContain(recent.id);
        expect(ids).not.toContain(old.id);
      });

      it('counts (and paginates) by GROUP, not by translation row — a group with 2 translations still counts once', async () => {
        const before = await groupRepository.listBySiteFiltered(
          tenantAId,
          siteAId,
          { page: 1, pageSize: 1 },
          {},
        );

        const group = buildGroup();
        await groupRepository.save(group);
        await translationRepository.save(
          buildTranslation(group.id, { locale: 'it' }),
          null,
        );
        await translationRepository.save(
          buildTranslation(group.id, { locale: 'en' }),
          null,
        );

        const after = await groupRepository.listBySiteFiltered(
          tenantAId,
          siteAId,
          { page: 1, pageSize: 1 },
          {},
        );

        // +1 group, not +2 (one per translation) — if the query joined and
        // paginated at the translation-row level instead, this would be +2.
        expect(after.total).toBe(before.total + 1);
      });
    });

    describe('saveWithVersion', () => {
      it('saves the group and its structure version together', async () => {
        const group = buildGroup({
          content: [{ type: 'Hero', props: { title: 'v1' } }],
        });
        const versionId = randomUUID();

        await groupRepository.saveWithVersion(group, {
          id: versionId,
          tenantId: tenantAId,
          pageGroupId: group.id,
          content: group.content,
          createdBy: null,
          createdAt: group.updatedAt,
        });

        const foundGroup = await groupRepository.findById(tenantAId, group.id);
        expect(foundGroup?.id).toBe(group.id);
        const versions = await groupVersionRepository.listByGroup(
          tenantAId,
          group.id,
        );
        expect(versions.map((v) => v.id)).toEqual([versionId]);
      });

      it('prunes to the last 10 versions, oldest first', async () => {
        const group = buildGroup();
        await groupRepository.save(group);

        const versionIds: string[] = [];
        for (let i = 0; i < 11; i++) {
          const id = randomUUID();
          versionIds.push(id);
          await groupRepository.saveWithVersion(group, {
            id,
            tenantId: tenantAId,
            pageGroupId: group.id,
            content: [{ type: 'Hero', props: { title: `v${i}` } }],
            createdBy: null,
            createdAt: new Date(Date.now() - (11 - i) * 1000),
          });
        }

        const versions = await groupVersionRepository.listByGroup(
          tenantAId,
          group.id,
        );
        expect(versions).toHaveLength(10);
        expect(versions.map((v) => v.id)).toEqual(versionIds.slice(1));
      });
    });
  });

  describe('PageTranslation', () => {
    it('saves and retrieves a translation by id, scoped to its tenant', async () => {
      const group = buildGroup();
      await groupRepository.save(group);
      const translation = buildTranslation(group.id, {
        fieldValues: { 'hero-1': { title: 'Ciao' } },
      });

      await translationRepository.save(translation, group.parentId);

      const found = await translationRepository.findById(
        tenantAId,
        translation.id,
      );
      expect(found?.id).toBe(translation.id);
      expect(found?.fieldValues).toEqual({ 'hero-1': { title: 'Ciao' } });

      const foundFromOtherTenant = await translationRepository.findById(
        tenantBId,
        translation.id,
      );
      expect(foundFromOtherTenant).toBeNull();
    });

    it('findByGroupAndLocale scopes by tenant, group and locale', async () => {
      const group = buildGroup();
      await groupRepository.save(group);
      const it_ = buildTranslation(group.id, { locale: 'it' });
      const en = buildTranslation(group.id, { locale: 'en' });
      await translationRepository.save(it_, null);
      await translationRepository.save(en, null);

      const found = await translationRepository.findByGroupAndLocale(
        tenantAId,
        group.id,
        'en',
      );
      expect(found?.id).toBe(en.id);
    });

    it('listByGroup returns every locale-translation of the same group, scoped to tenant', async () => {
      const group = buildGroup();
      await groupRepository.save(group);
      const otherGroup = buildGroup();
      await groupRepository.save(otherGroup);
      const italian = buildTranslation(group.id, {
        locale: 'it',
        slug: 'chi-siamo',
      });
      const english = buildTranslation(group.id, {
        locale: 'en',
        slug: 'about-us',
      });
      const unrelated = buildTranslation(otherGroup.id, {
        locale: 'it',
        slug: 'contatti',
      });
      await translationRepository.save(italian, null);
      await translationRepository.save(english, null);
      await translationRepository.save(unrelated, null);

      const found = await translationRepository.listByGroup(
        tenantAId,
        group.id,
      );
      expect(found.map((t) => t.locale).sort()).toEqual(['en', 'it']);

      const foundFromOtherTenant = await translationRepository.listByGroup(
        tenantBId,
        group.id,
      );
      expect(foundFromOtherTenant).toHaveLength(0);
    });

    describe('findByParentGroupAndLocaleSlug (public resolution)', () => {
      it('resolves a root-level translation by (site, locale, slug)', async () => {
        const group = buildGroup();
        await groupRepository.save(group);
        const translation = buildTranslation(group.id, {
          locale: 'it',
          slug: 'home',
        });
        await translationRepository.save(translation, null);

        const found =
          await translationRepository.findByParentGroupAndLocaleSlug(
            tenantAId,
            siteAId,
            'it',
            null,
            'home',
          );
        expect(found?.id).toBe(translation.id);
      });

      it('does not match a translation with the same slug under a different parent group', async () => {
        const parentA = buildGroup();
        const parentB = buildGroup();
        await groupRepository.save(parentA);
        await groupRepository.save(parentB);
        const childOfA = buildGroup({ parentId: parentA.id });
        const childOfB = buildGroup({ parentId: parentB.id });
        await groupRepository.save(childOfA);
        await groupRepository.save(childOfB);
        const translationA = buildTranslation(childOfA.id, {
          slug: 'same-slug',
        });
        const translationB = buildTranslation(childOfB.id, {
          slug: 'same-slug',
        });
        await translationRepository.save(translationA, parentA.id);
        await translationRepository.save(translationB, parentB.id);

        const foundUnderA =
          await translationRepository.findByParentGroupAndLocaleSlug(
            tenantAId,
            siteAId,
            'it',
            parentA.id,
            'same-slug',
          );
        expect(foundUnderA?.id).toBe(translationA.id);

        const foundAtRoot =
          await translationRepository.findByParentGroupAndLocaleSlug(
            tenantAId,
            siteAId,
            'it',
            null,
            'same-slug',
          );
        expect(foundAtRoot).toBeNull();
      });
    });

    it('deletes a translation scoped to its tenant', async () => {
      const group = buildGroup();
      await groupRepository.save(group);
      const translation = buildTranslation(group.id);
      await translationRepository.save(translation, null);

      await translationRepository.delete(tenantAId, translation.id);

      expect(
        await translationRepository.findById(tenantAId, translation.id),
      ).toBeNull();
    });

    // Regression: same reasoning as DrizzlePageRepository's own — the
    // check-then-act in the use-case layer isn't atomic, the DB constraint
    // is the real backstop under concurrency.
    it('save() rejects a second ROOT-level translation with the same tenant/site/locale/slug with PageSlugAlreadyExistsError', async () => {
      const group = buildGroup();
      await groupRepository.save(group);
      const otherGroup = buildGroup();
      await groupRepository.save(otherGroup);
      const first = buildTranslation(group.id, { slug: 'stessa-slug' });
      await translationRepository.save(first, null);

      const second = buildTranslation(otherGroup.id, { slug: 'stessa-slug' });
      await expect(translationRepository.save(second, null)).rejects.toThrow(
        PageSlugAlreadyExistsError,
      );
    });

    it('save() rejects a second translation with the same slug under the SAME non-root parent group with PageSlugAlreadyExistsError', async () => {
      const parent = buildGroup();
      await groupRepository.save(parent);
      const groupA = buildGroup({ parentId: parent.id });
      const groupB = buildGroup({ parentId: parent.id });
      await groupRepository.save(groupA);
      await groupRepository.save(groupB);
      const first = buildTranslation(groupA.id, { slug: 'stessa-slug' });
      await translationRepository.save(first, parent.id);

      const second = buildTranslation(groupB.id, { slug: 'stessa-slug' });
      await expect(
        translationRepository.save(second, parent.id),
      ).rejects.toThrow(PageSlugAlreadyExistsError);
    });

    it('save() allows the same slug for two translations under DIFFERENT parent groups (sibling-scoped uniqueness)', async () => {
      const parentA = buildGroup();
      const parentB = buildGroup();
      await groupRepository.save(parentA);
      await groupRepository.save(parentB);
      const groupA = buildGroup({ parentId: parentA.id });
      const groupB = buildGroup({ parentId: parentB.id });
      await groupRepository.save(groupA);
      await groupRepository.save(groupB);
      const first = buildTranslation(groupA.id, { slug: 'stessa-slug' });
      await translationRepository.save(first, parentA.id);

      const second = buildTranslation(groupB.id, { slug: 'stessa-slug' });
      await expect(
        translationRepository.save(second, parentB.id),
      ).resolves.toBeUndefined();
    });

    it('save() rejects a second translation in the same group with an already-used locale with PageTranslationLocaleAlreadyExistsError', async () => {
      const group = buildGroup();
      await groupRepository.save(group);
      const first = buildTranslation(group.id, { locale: 'it' });
      await translationRepository.save(first, null);

      const second = buildTranslation(group.id, { locale: 'it' });
      await expect(translationRepository.save(second, null)).rejects.toThrow(
        PageTranslationLocaleAlreadyExistsError,
      );
    });

    describe('saveWithVersion', () => {
      it('saves the translation and its text version together', async () => {
        const group = buildGroup();
        await groupRepository.save(group);
        const translation = buildTranslation(group.id, {
          fieldValues: { 'hero-1': { title: 'v1' } },
        });
        const versionId = randomUUID();

        await translationRepository.saveWithVersion(
          translation,
          {
            id: versionId,
            tenantId: tenantAId,
            pageTranslationId: translation.id,
            fieldValues: translation.fieldValues,
            seoMeta: translation.seoMeta,
            createdBy: null,
            createdAt: translation.updatedAt,
          },
          null,
        );

        const foundTranslation = await translationRepository.findById(
          tenantAId,
          translation.id,
        );
        expect(foundTranslation?.id).toBe(translation.id);
        const versions = await translationVersionRepository.listByTranslation(
          tenantAId,
          translation.id,
        );
        expect(versions.map((v) => v.id)).toEqual([versionId]);
      });

      it('prunes to the last 10 versions per translation, oldest first', async () => {
        const group = buildGroup();
        await groupRepository.save(group);
        const translation = buildTranslation(group.id);
        await translationRepository.save(translation, null);

        const versionIds: string[] = [];
        for (let i = 0; i < 11; i++) {
          const id = randomUUID();
          versionIds.push(id);
          await translationRepository.saveWithVersion(
            translation,
            {
              id,
              tenantId: tenantAId,
              pageTranslationId: translation.id,
              fieldValues: { 'hero-1': { title: `v${i}` } },
              seoMeta: translation.seoMeta,
              createdBy: null,
              createdAt: new Date(Date.now() - (11 - i) * 1000),
            },
            null,
          );
        }

        const versions = await translationVersionRepository.listByTranslation(
          tenantAId,
          translation.id,
        );
        expect(versions).toHaveLength(10);
        expect(versions.map((v) => v.id)).toEqual(versionIds.slice(1));
      });
    });
  });
});
