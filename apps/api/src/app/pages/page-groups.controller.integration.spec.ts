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
  deleteIntegrationFixtures,
  sites,
  users,
  withTenant,
} from '@brisk/postgres-db';
import { AUTH_PORT } from '../auth/auth.tokens';
import { DATABASE } from '../database.module';
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
      imports: [PagesModule],
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
      },
      {
        locale: 'it',
        slug: searchSlug,
        title: 'Idraulico a Roma',
        status: 'draft',
        isDiverged: false,
      },
    ]);
  });
});
