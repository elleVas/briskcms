import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HttpExceptionFilter } from '../http-exception.filter';
import { requestIdMiddleware } from '../request-id.middleware';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { AuthPort } from '@brisk/ports';
import {
  type BriskDb,
  collections,
  deleteIntegrationFixtures,
  reusableSections,
  sites,
  users,
  withTenant,
} from '@brisk/postgres-db';
import { AUTH_PORT } from '../auth/auth.tokens';
import { CollectionsModule } from '../collections/collections.module';
import { DATABASE } from '../database.module';
import { ReusableSectionsModule } from '../reusable-sections/reusable-sections.module';
import { PagesModule } from './pages.module';

/**
 * Runs against a real Postgres, through the real HTTP stack — same setup
 * discipline as pages.controller.integration.spec.ts (see its own doc
 * comment for why a throwaway site is created per run instead of reusing
 * the dev seed). Deleting the site cascades to page_groups ->
 * page_translations -> both version tables (schema.ts), so afterAll's
 * single deleteIntegrationFixtures call is enough cleanup.
 */
describe('PageGroupsController (integration)', () => {
  let app: INestApplication;
  let db: BriskDb;
  let agent: ReturnType<typeof request.agent>;
  let siteId: string;
  let tenantId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      // Collections and sections too, for the rule that spans all three:
      // the template a collection preselects must be one a page can start
      // from, and deleting it must take only the suggestion away.
      imports: [PagesModule, CollectionsModule, ReusableSectionsModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.use(requestIdMiddleware);
    await app.init();
    db = app.get<BriskDb>(DATABASE);

    tenantId = process.env.DEFAULT_TENANT_ID as string;

    const [site] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(sites)
        .values({
          tenantId,
          name: `Integration Site ${randomUUID()}`,
          defaultLocale: 'en',
        })
        .returning({ id: sites.id }),
    );
    siteId = site.id;

    const authPort = app.get<AuthPort>(AUTH_PORT);
    const email = `integration-${randomUUID()}@example.test`;
    const password = randomUUID();
    const passwordHash = await authPort.hashPassword(password);
    const [user] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(users)
        .values({ tenantId, email, passwordHash, role: 'admin' })
        .returning({ id: users.id }),
    );
    createdUserIds.push(user.id);

    agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email, password, captchaToken: 'test-token' })
      .expect(200);
  });

  afterAll(async () => {
    await deleteIntegrationFixtures(db, tenantId, {
      siteIds: [siteId],
      userIds: createdUserIds,
    });
    await app.close();
    await db.$client.end();
  });

  it('runs the full create group -> translate -> save -> publish -> diverge cycle over HTTP', async () => {
    const createGroupRes = await agent
      .post('/page-groups')
      .send({ siteId })
      .expect(201);
    expect(createGroupRes.body.content).toEqual([]);
    const groupId = createGroupRes.body.id;

    const contentRes = await agent
      .patch(`/page-groups/${groupId}/content`)
      .send({
        content: [{ id: 'block-1', type: 'Hero', props: { title: 'Hello' } }],
      })
      .expect(200);
    expect(contentRes.body.content).toEqual([
      { id: 'block-1', type: 'Hero', props: { title: 'Hello' } },
    ]);

    const enTranslationRes = await agent
      .post(`/page-groups/${groupId}/translations`)
      .send({
        locale: 'en',
        slug: `home-${randomUUID()}`,
        seoMeta: { title: 'Home', description: '' },
      })
      .expect(201);
    expect(enTranslationRes.body.fieldValues).toEqual({});
    const enTranslationId = enTranslationRes.body.id;

    const itTranslationRes = await agent
      .post(`/page-groups/${groupId}/translations`)
      .send({
        locale: 'it',
        slug: `home-it-${randomUUID()}`,
        seoMeta: { title: 'Home', description: '' },
      })
      .expect(201);
    const itTranslationId = itTranslationRes.body.id;

    const fieldValuesRes = await agent
      .patch(`/page-groups/translations/${itTranslationId}/field-values`)
      .send({
        fieldValues: { 'block-1': { title: 'Ciao' } },
        parentGroupId: null,
      })
      .expect(200);
    expect(fieldValuesRes.body.fieldValues).toEqual({
      'block-1': { title: 'Ciao' },
    });

    const publishItRes = await agent
      .post(`/page-groups/translations/${itTranslationId}/publish`)
      .expect(201);
    expect(publishItRes.body.status).toBe('published');
    expect(publishItRes.body.publishedSnapshot).toEqual([
      { id: 'block-1', type: 'Hero', props: { title: 'Ciao' } },
    ]);

    // en never got a fieldValues overlay — publishing it must still fall
    // back to the group's own (default-locale) content untouched.
    const publishEnRes = await agent
      .post(`/page-groups/translations/${enTranslationId}/publish`)
      .expect(201);
    expect(publishEnRes.body.publishedSnapshot).toEqual([
      { id: 'block-1', type: 'Hero', props: { title: 'Hello' } },
    ]);

    const listRes = await agent
      .get(`/page-groups/${groupId}/translations`)
      .expect(200);
    expect(listRes.body.map((t: { id: string }) => t.id).sort()).toEqual(
      [enTranslationId, itTranslationId].sort(),
    );

    const divergeRes = await agent
      .post(`/page-groups/translations/${itTranslationId}/diverge`)
      .expect(201);
    expect(divergeRes.body.isDiverged).toBe(true);
    expect(divergeRes.body.divergedContent).toEqual([
      { id: 'block-1', type: 'Hero', props: { title: 'Ciao' } },
    ]);

    // Once diverged, a structural change to the group must not reach it.
    await agent
      .patch(`/page-groups/${groupId}/content`)
      .send({
        content: [
          { id: 'block-1', type: 'Hero', props: { title: 'Hello v2' } },
        ],
      })
      .expect(200);
    const stillDivergedRes = await agent
      .get(`/page-groups/${groupId}/translations`)
      .expect(200);
    const itAfter = stillDivergedRes.body.find(
      (t: { id: string }) => t.id === itTranslationId,
    );
    expect(itAfter.divergedContent).toEqual([
      { id: 'block-1', type: 'Hero', props: { title: 'Ciao' } },
    ]);

    const groupVersionsRes = await agent
      .get(`/page-groups/${groupId}/versions`)
      .expect(200);
    // create + 2 saveContent calls; publish/diverge/translations never write
    // a PageGroupVersion.
    expect(groupVersionsRes.body).toHaveLength(3);

    const translationVersionsRes = await agent
      .get(`/page-groups/translations/${itTranslationId}/versions`)
      .expect(200);
    // saveFieldValues + diverge; createTranslation/publish never write a
    // PageTranslationVersion (see savePageTranslationFieldValues vs.
    // updatePageTranslationSeoMeta's plain save).
    expect(translationVersionsRes.body).toHaveLength(2);
  });

  it('deletes a group, over the real HTTP endpoint', async () => {
    const groupRes = await agent
      .post('/page-groups')
      .send({ siteId, content: [] })
      .expect(201);
    await agent
      .post(`/page-groups/${groupRes.body.id}/translations`)
      .send({
        locale: 'it',
        slug: `cancellare-${randomUUID()}`,
        seoMeta: { title: 'Da cancellare', description: '' },
      })
      .expect(201);

    await agent.delete(`/page-groups/${groupRes.body.id}`).expect(204);

    await agent.get(`/page-groups/${groupRes.body.id}`).expect(404);
  });

  it('rolls back a group to a previous version, over the real HTTP endpoint', async () => {
    const groupRes = await agent
      .post('/page-groups')
      .send({
        siteId,
        content: [{ id: 'block-1', type: 'Hero', props: { title: 'V1' } }],
      })
      .expect(201);
    const groupId = groupRes.body.id;
    const [initialVersion] = (
      await agent.get(`/page-groups/${groupId}/versions`).expect(200)
    ).body;

    await agent
      .patch(`/page-groups/${groupId}/content`)
      .send({
        content: [{ id: 'block-1', type: 'Hero', props: { title: 'V2' } }],
      })
      .expect(200);

    const rollbackRes = await agent
      .patch(`/page-groups/${groupId}/rollback`)
      .send({ versionId: initialVersion.id })
      .expect(200);
    expect(rollbackRes.body.content).toEqual([
      { id: 'block-1', type: 'Hero', props: { title: 'V1' } },
    ]);

    const versionsAfterRollback = await agent
      .get(`/page-groups/${groupId}/versions`)
      .expect(200);
    // create + saveContent(V2) + the rollback itself — history is never
    // overwritten, only appended to.
    expect(versionsAfterRollback.body).toHaveLength(3);

    await agent
      .patch(`/page-groups/${groupId}/rollback`)
      .send({ versionId: randomUUID() })
      .expect(404);
  });

  it('reorders a sibling group of page groups, over the real HTTP endpoint', async () => {
    // Scoped under a fresh parent (not root) so this test's sibling group
    // is isolated from every other group any other test in this file
    // creates at the root level — reorder validates an EXACT permutation
    // of the real sibling group, so it can't tolerate unrelated siblings.
    const parentRes = await agent
      .post('/page-groups')
      .send({ siteId, content: [] })
      .expect(201);
    const parentId = parentRes.body.id;
    const childA = await agent
      .post('/page-groups')
      .send({ siteId, parentId, content: [] })
      .expect(201);
    const childB = await agent
      .post('/page-groups')
      .send({ siteId, parentId, content: [] })
      .expect(201);
    const childC = await agent
      .post('/page-groups')
      .send({ siteId, parentId, content: [] })
      .expect(201);

    await agent
      .patch('/page-groups/reorder')
      .send({
        siteId,
        parentId,
        orderedPageGroupIds: [childC.body.id, childA.body.id, childB.body.id],
      })
      .expect(204);

    const reorderedA = await agent
      .get(`/page-groups/${childA.body.id}`)
      .expect(200);
    const reorderedB = await agent
      .get(`/page-groups/${childB.body.id}`)
      .expect(200);
    const reorderedC = await agent
      .get(`/page-groups/${childC.body.id}`)
      .expect(200);
    expect(reorderedC.body.order).toBe(0);
    expect(reorderedA.body.order).toBe(1);
    expect(reorderedB.body.order).toBe(2);

    await agent
      .patch('/page-groups/reorder')
      .send({
        siteId,
        parentId,
        orderedPageGroupIds: [childA.body.id],
      })
      .expect(400);
  });

  it('duplicates a group with every translation, over the real HTTP endpoint', async () => {
    const groupRes = await agent
      .post('/page-groups')
      .send({
        siteId,
        content: [{ id: 'block-1', type: 'Hero', props: { title: 'Ciao' } }],
      })
      .expect(201);
    const groupId = groupRes.body.id;
    const originalSlug = `idraulico-duplica-${randomUUID()}`;
    await agent
      .post(`/page-groups/${groupId}/translations`)
      .send({
        locale: 'it',
        slug: originalSlug,
        seoMeta: { title: 'Idraulico', description: '' },
      })
      .expect(201);
    const frTranslationRes = await agent
      .post(`/page-groups/${groupId}/translations`)
      .send({
        locale: 'fr',
        slug: `${originalSlug}-fr`,
        seoMeta: { title: 'Plombier', description: '' },
      })
      .expect(201);
    await agent
      .post(`/page-groups/translations/${frTranslationRes.body.id}/publish`)
      .expect(201);

    const duplicateRes = await agent
      .post(`/page-groups/${groupId}/duplicate`)
      .expect(201);
    expect(duplicateRes.body.id).not.toBe(groupId);
    expect(duplicateRes.body.content).toEqual([
      { id: 'block-1', type: 'Hero', props: { title: 'Ciao' } },
    ]);

    const duplicateTranslationsRes = await agent
      .get(`/page-groups/${duplicateRes.body.id}/translations`)
      .expect(200);
    const bySlug = new Map(
      duplicateTranslationsRes.body.map(
        (t: {
          slug: string;
          locale: string;
          status: string;
          seoMeta: { title: string };
        }) => [t.locale, t],
      ),
    );
    expect(bySlug.get('it')).toMatchObject({
      slug: `${originalSlug}-copy`,
      status: 'draft',
      seoMeta: { title: 'Idraulico' },
    });
    expect(bySlug.get('fr')).toMatchObject({
      slug: `${originalSlug}-fr-copy`,
      // The source's fr translation was published — the duplicate must
      // still start as an unpublished draft.
      status: 'draft',
      seoMeta: { title: 'Plombier' },
    });
  });

  /*
   * The editor's New page: the page and its first language in one request.
   * Refused for its address, it must leave nothing behind — it used to
   * leave a page with no language, which crashed the editor that opened it.
   */
  it('creates a page with its first language in one request, and nothing when the address is taken', async () => {
    const slug = `about-${randomUUID()}`;
    const translation = {
      locale: 'en',
      slug,
      seoMeta: { title: 'About', description: '' },
    };
    const created = await agent
      .post('/page-groups')
      .send({ siteId, translation })
      .expect(201);
    const translations = await agent
      .get(`/page-groups/${created.body.id}/translations`)
      .expect(200);
    expect(translations.body).toHaveLength(1);
    const before = await agent
      .get('/page-groups')
      .query({ siteId, pageSize: 100 })
      .expect(200);

    await agent
      .post('/page-groups')
      .send({
        siteId,
        translation: {
          ...translation,
          seoMeta: { title: 'Again', description: '' },
        },
      })
      .expect(409);

    const after = await agent
      .get('/page-groups')
      .query({ siteId, pageSize: 100 })
      .expect(200);
    expect(after.body.total).toBe(before.body.total);
  });

  it('keeps a duplicated article in its collection, over the real HTTP endpoint', async () => {
    const [news] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(collections)
        .values({ tenantId, siteId, name: `News ${randomUUID()}` })
        .returning({ id: collections.id }),
    );
    const articleRes = await agent
      .post('/page-groups')
      .send({ siteId, collectionId: news.id })
      .expect(201);

    const duplicateRes = await agent
      .post(`/page-groups/${articleRes.body.id}/duplicate`)
      .expect(201);

    expect(duplicateRes.body.collectionId).toBe(news.id);
  });

  it('saves a page as a template and starts a new page from it, over the real HTTP endpoint', async () => {
    const pageRes = await agent
      .post('/page-groups')
      .send({
        siteId,
        content: [
          { id: 'hero-1', type: 'Hero', props: { title: 'Plumber' } },
          {
            id: 'newsletter-1',
            type: 'Section',
            props: {
              section: {
                sectionId: randomUUID(),
                sectionName: 'Newsletter',
              },
            },
          },
        ],
      })
      .expect(201);
    const pageId = pageRes.body.id;
    await agent
      .post(`/page-groups/${pageId}/translations`)
      .send({
        locale: 'en',
        slug: `plumber-${randomUUID()}`,
        seoMeta: { title: 'Plumber', description: '' },
      })
      .expect(201);
    const itRes = await agent
      .post(`/page-groups/${pageId}/translations`)
      .send({
        locale: 'it',
        slug: `idraulico-${randomUUID()}`,
        seoMeta: { title: 'Idraulico', description: '' },
      })
      .expect(201);
    await agent
      .patch(`/page-groups/translations/${itRes.body.id}/field-values`)
      .send({
        fieldValues: { 'hero-1': { title: 'Idraulico' } },
        parentGroupId: null,
      })
      .expect(200);

    const templateName = `Service page ${randomUUID()}`;
    const templateRes = await agent
      .post(`/page-groups/${pageId}/save-as-template`)
      .send({ name: templateName })
      .expect(201);
    // The site's default language is English: the Italian overlay stays
    // behind, and the template is ready to use at once.
    expect(templateRes.body).toMatchObject({
      name: templateName,
      kind: 'template',
      status: 'published',
      siteId,
    });
    expect(templateRes.body.content[0].props).toEqual({ title: 'Plumber' });
    expect(templateRes.body.publishedContent).toEqual(templateRes.body.content);

    await agent
      .post(`/page-groups/${pageId}/save-as-template`)
      .send({ name: templateName })
      .expect(409);

    // Without its first language, a page may not start from a template.
    await agent
      .post('/page-groups')
      .send({ siteId, templateId: templateRes.body.id })
      .expect(400);
    const fromTemplateSlug = `from-template-${randomUUID()}`;
    const fromTemplateRes = await agent
      .post('/page-groups')
      .send({
        siteId,
        templateId: templateRes.body.id,
        translation: {
          locale: 'en',
          slug: fromTemplateSlug,
          seoMeta: { title: 'From a template', description: '' },
        },
      })
      .expect(201);
    const fromTemplateTranslations = await agent
      .get(`/page-groups/${fromTemplateRes.body.id}/translations`)
      .expect(200);
    expect(
      fromTemplateTranslations.body.map((t: { slug: string }) => t.slug),
    ).toEqual([fromTemplateSlug]);
    const content = fromTemplateRes.body.content as {
      id: string;
      type: string;
      props: Record<string, unknown>;
    }[];
    expect(content.map((block) => block.type)).toEqual(['Hero', 'Section']);
    expect(content[0].props).toEqual({ title: 'Plumber' });
    // The newsletter is still a reference to the shared section, not a copy.
    expect(content[1].props).toEqual(pageRes.body.content[1].props);
    for (const block of content) {
      expect(['hero-1', 'newsletter-1']).not.toContain(block.id);
    }
  });

  it('refuses to start a page from anything but a published template of the site, over the real HTTP endpoint', async () => {
    const [shared, draft] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(reusableSections)
        .values([
          {
            tenantId,
            siteId,
            name: `Shared ${randomUUID()}`,
            kind: 'shared',
            status: 'published',
            content: [],
            publishedContent: [],
          },
          {
            tenantId,
            siteId,
            name: `Draft ${randomUUID()}`,
            kind: 'template',
            status: 'draft',
            content: [],
          },
        ])
        .returning({ id: reusableSections.id }),
    );

    const translation = {
      locale: 'en',
      slug: `refused-${randomUUID()}`,
      seoMeta: { title: 'Refused', description: '' },
    };
    const pagesBefore = await agent
      .get('/page-groups')
      .query({ siteId, pageSize: 100 })
      .expect(200);

    // A shared section, a draft and a missing id are one answer to the
    // person starting a page: there is no such template to start from.
    for (const templateId of [shared.id, draft.id, randomUUID()]) {
      await agent
        .post('/page-groups')
        .send({ siteId, templateId, translation })
        .expect(404);
    }
    await agent
      .post('/page-groups')
      .send({ siteId, templateId: draft.id, content: [], translation })
      .expect(400);

    const pagesAfter = await agent
      .get('/page-groups')
      .query({ siteId, pageSize: 100 })
      .expect(200);
    expect(pagesAfter.body.total).toBe(pagesBefore.body.total);
  });

  it('gives a collection a default template, refuses one a page cannot start from, and forgets it when the template goes, over the real HTTP endpoint', async () => {
    const [template, shared] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(reusableSections)
        .values([
          {
            tenantId,
            siteId,
            name: `Article ${randomUUID()}`,
            kind: 'template',
            status: 'published',
            content: [],
            publishedContent: [],
          },
          {
            tenantId,
            siteId,
            name: `Newsletter ${randomUUID()}`,
            kind: 'shared',
            status: 'published',
            content: [],
            publishedContent: [],
          },
        ])
        .returning({ id: reusableSections.id }),
    );
    const collectionRes = await agent
      .post('/collections')
      .send({ siteId, name: 'News' })
      .expect(201);
    expect(collectionRes.body.defaultTemplateId).toBeNull();
    const collectionId = collectionRes.body.id;

    const setRes = await agent
      .patch(`/collections/${collectionId}`)
      .send({ defaultTemplateId: template.id })
      .expect(200);
    expect(setRes.body.defaultTemplateId).toBe(template.id);

    await agent
      .patch(`/collections/${collectionId}`)
      .send({ defaultTemplateId: shared.id })
      .expect(404);
    const listRes = await agent
      .get('/collections')
      .query({ siteId })
      .expect(200);
    const listed = listRes.body.find(
      (one: { id: string }) => one.id === collectionId,
    );
    expect(listed.defaultTemplateId).toBe(template.id);

    // Deleting the template takes the suggestion away, not the collection.
    await agent.delete(`/reusable-sections/${template.id}`).expect(200);
    const afterDeleteRes = await agent
      .get('/collections')
      .query({ siteId })
      .expect(200);
    expect(
      afterDeleteRes.body.find((one: { id: string }) => one.id === collectionId)
        .defaultTemplateId,
    ).toBeNull();

    const clearedRes = await agent
      .patch(`/collections/${collectionId}`)
      .send({ defaultTemplateId: null })
      .expect(200);
    expect(clearedRes.body.defaultTemplateId).toBeNull();
  });

  it('lists groups filtered by title search and locale, over the real public HTTP endpoint', async () => {
    const searchSlug = `idraulico-${randomUUID()}`;
    const groupRes = await agent
      .post('/page-groups')
      .send({ siteId, content: [] })
      .expect(201);
    await agent
      .post(`/page-groups/${groupRes.body.id}/translations`)
      .send({
        locale: 'it',
        slug: searchSlug,
        seoMeta: { title: 'Idraulico a Roma', description: '' },
      })
      .expect(201);
    await agent
      .post(`/page-groups/${groupRes.body.id}/translations`)
      .send({
        locale: 'fr',
        slug: `${searchSlug}-fr`,
        seoMeta: { title: 'Plombier à Rome', description: '' },
      })
      .expect(201);

    const bySearch = await agent
      .get('/page-groups')
      .query({ siteId, search: 'Idraulico' })
      .expect(200);
    const searchIds = bySearch.body.items.map(
      (item: { id: string }) => item.id,
    );
    expect(searchIds).toContain(groupRes.body.id);

    const byWrongSearch = await agent
      .get('/page-groups')
      .query({ siteId, search: 'Elettricista' })
      .expect(200);
    const wrongSearchIds = byWrongSearch.body.items.map(
      (item: { id: string }) => item.id,
    );
    expect(wrongSearchIds).not.toContain(groupRes.body.id);

    const byLocale = await agent
      .get('/page-groups')
      .query({ siteId, locale: 'fr' })
      .expect(200);
    const localeIds = byLocale.body.items.map(
      (item: { id: string }) => item.id,
    );
    expect(localeIds).toContain(groupRes.body.id);

    const row = bySearch.body.items.find(
      (item: { id: string }) => item.id === groupRes.body.id,
    );
    expect(
      row.translations.sort((a: { locale: string }, b: { locale: string }) =>
        a.locale.localeCompare(b.locale),
      ),
    ).toEqual([
      {
        locale: 'fr',
        slug: `${searchSlug}-fr`,
        title: 'Plombier à Rome',
        status: 'draft',
        isDiverged: false,
        hasUnpublishedChanges: false,
      },
      {
        locale: 'it',
        slug: searchSlug,
        title: 'Idraulico a Roma',
        status: 'draft',
        isDiverged: false,
        hasUnpublishedChanges: false,
      },
    ]);
  });
});
