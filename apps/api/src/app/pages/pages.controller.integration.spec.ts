import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { AuthPort, UserRepositoryPort } from '@brisk/ports';
import {
  type BriskDb,
  deleteIntegrationFixtures,
  sites,
  users,
  withTenant,
} from '@brisk/postgres-db';
import { AUTH_PORT, USER_REPOSITORY } from '../auth/auth.tokens.js';
import { DATABASE } from '../database.module.js';
import { PagesModule } from './pages.module.js';

/**
 * Runs against a real Postgres, through the real HTTP stack — see
 * docs/development.md ("docker compose up -d postgres", run migrations,
 * then `pnpm --filter @brisk/postgres-db run db:seed` so DEFAULT_TENANT_ID
 * exists). Every route requires a session (see docs/adr/0010) — logs in
 * once via a cookie-persisting supertest agent, shared across every test
 * below.
 *
 * Creates its own throwaway site + user under DEFAULT_TENANT_ID in
 * beforeAll, instead of reusing DEFAULT_SITE_ID/DEFAULT_USER_EMAIL. Can't
 * use a separate tenant like drizzle-page.repository.integration.spec.ts
 * does: this is a single-tenant-per-deployment product, and /auth/login
 * always resolves the user within DEFAULT_TENANT_ID (see AuthController) —
 * but the site has no such constraint. Reusing the shared dev seed meant
 * every test run left several "Title" pages behind in the exact site the
 * dev editor-app displays, since most of these tests create pages but
 * never delete them.
 */
describe('PagesController (integration)', () => {
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
    await app.init();
    db = app.get<BriskDb>(DATABASE);

    tenantId = process.env.DEFAULT_TENANT_ID as string;

    const [site] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(sites)
        .values({
          tenantId,
          name: `Integration Site ${randomUUID()}`,
          defaultLocale: 'it',
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
    await agent.post('/auth/login').send({ email, password }).expect(200);
  });

  afterAll(async () => {
    await deleteIntegrationFixtures(db, tenantId, {
      siteIds: [siteId],
      userIds: createdUserIds,
    });
    await app.close();
    await db.$client.end();
  });

  function createPageBody(overrides: Record<string, unknown> = {}) {
    return {
      siteId,
      groupId: randomUUID(),
      locale: 'it',
      slug: `page-${randomUUID()}`,
      seoMeta: { title: 'Title', description: 'Description' },
      ...overrides,
    };
  }

  it('runs the full create -> draft -> publish -> rollback cycle over HTTP', async () => {
    const createRes = await agent
      .post('/pages')
      .send(createPageBody())
      .expect(201);

    expect(createRes.body.status).toBe('draft');
    expect(createRes.body.publishedContent).toBeNull();
    const pageId = createRes.body.id;

    const draftRes = await agent
      .patch(`/pages/${pageId}/draft`)
      .send({ content: [{ type: 'Hero', props: { title: 'v1' } }] })
      .expect(200);
    expect(draftRes.body.content).toEqual([
      { type: 'Hero', props: { title: 'v1' } },
    ]);

    const publishRes = await agent.post(`/pages/${pageId}/publish`).expect(201);
    expect(publishRes.body.status).toBe('published');
    expect(publishRes.body.publishedContent).toEqual([
      { type: 'Hero', props: { title: 'v1' } },
    ]);

    const versionsRes = await agent
      .get(`/pages/${pageId}/versions`)
      .expect(200);
    expect(versionsRes.body).toHaveLength(2); // create, draft v1
    const firstVersionId = versionsRes.body[0].id;

    const rollbackRes = await agent
      .post(`/pages/${pageId}/rollback`)
      .send({ versionId: firstVersionId })
      .expect(201);
    expect(rollbackRes.body.content).toEqual([]);
    // rollback restores the draft only, the published copy is untouched
    expect(rollbackRes.body.publishedContent).toEqual([
      { type: 'Hero', props: { title: 'v1' } },
    ]);
  });

  it('updates seoMeta without touching content', async () => {
    const createRes = await agent
      .post('/pages')
      .send(createPageBody())
      .expect(201);
    const pageId = createRes.body.id;
    await agent
      .patch(`/pages/${pageId}/draft`)
      .send({ content: [{ type: 'Text', props: { body: 'ciao' } }] })
      .expect(200);

    const seoRes = await agent
      .patch(`/pages/${pageId}/seo`)
      .send({
        seoMeta: {
          title: 'Nuovo titolo SEO',
          description: 'Nuova descrizione',
          canonical: 'https://example.com/pagina',
        },
      })
      .expect(200);

    expect(seoRes.body.seoMeta).toEqual({
      title: 'Nuovo titolo SEO',
      description: 'Nuova descrizione',
      canonical: 'https://example.com/pagina',
    });
    expect(seoRes.body.content).toEqual([
      { type: 'Text', props: { body: 'ciao' } },
    ]);
  });

  it('404s updating seo for a page that does not exist', async () => {
    await agent
      .patch(`/pages/${randomUUID()}/seo`)
      .send({ seoMeta: { title: 'x', description: '' } })
      .expect(404);
  });

  it('findBySlug and findById return the same page', async () => {
    const body = createPageBody();
    const createRes = await agent.post('/pages').send(body).expect(201);

    const byId = await agent.get(`/pages/${createRes.body.id}`).expect(200);
    const bySlug = await agent
      .get('/pages/by-slug')
      .query({ siteId, locale: body.locale, slug: body.slug })
      .expect(200);

    expect(byId.body.id).toBe(createRes.body.id);
    expect(bySlug.body.id).toBe(createRes.body.id);
  });

  it('lists pages for a site', async () => {
    const first = await agent.post('/pages').send(createPageBody()).expect(201);
    const second = await agent
      .post('/pages')
      .send(createPageBody())
      .expect(201);

    const res = await agent
      .get('/pages')
      .query({ siteId, pageSize: 100 })
      .expect(200);

    const ids = res.body.items.map((page: { id: string }) => page.id);
    expect(ids).toEqual(
      expect.arrayContaining([first.body.id, second.body.id]),
    );
    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  it('paginates the results', async () => {
    const uniquePrefix = `paginate-${randomUUID()}`;
    for (let i = 0; i < 3; i++) {
      await agent
        .post('/pages')
        .send(createPageBody({ slug: `${uniquePrefix}-${i}` }))
        .expect(201);
    }

    const firstPage = await agent
      .get('/pages')
      .query({ siteId, page: 1, pageSize: 2 })
      .expect(200);
    expect(firstPage.body.items).toHaveLength(2);
    expect(firstPage.body.total).toBeGreaterThanOrEqual(3);

    const secondPage = await agent
      .get('/pages')
      .query({ siteId, page: 2, pageSize: 2 })
      .expect(200);
    expect(secondPage.body.items).toHaveLength(2);

    const firstIds = firstPage.body.items.map((p: { id: string }) => p.id);
    const secondIds = secondPage.body.items.map((p: { id: string }) => p.id);
    expect(firstIds.some((id: string) => secondIds.includes(id))).toBe(false);
  });

  it('defaults to page 1 with a pageSize of 20 when not specified', async () => {
    const res = await agent.get('/pages').query({ siteId }).expect(200);

    expect(res.body.items.length).toBeLessThanOrEqual(20);
    expect(typeof res.body.total).toBe('number');
  });

  it('400s on a pageSize above the allowed maximum', async () => {
    await agent.get('/pages').query({ siteId, pageSize: 1000 }).expect(400);
  });

  it('400s on an invalid siteId query param instead of hitting the database', async () => {
    await agent.get('/pages').query({ siteId: 'not-a-uuid' }).expect(400);
  });

  it('404s on a page that does not exist', async () => {
    await agent.get(`/pages/${randomUUID()}`).expect(404);
  });

  it('400s on an invalid create body instead of hitting the database', async () => {
    const res = await agent
      .post('/pages')
      .send({ siteId: 'not-a-uuid' })
      .expect(400);

    expect(res.body.fieldErrors.siteId).toBeDefined();
  });

  it('400s on a slug that is not already in canonical (lowercase, hyphenated) form', async () => {
    const res = await agent
      .post('/pages')
      .send(createPageBody({ slug: 'Not A Valid Slug!' }))
      .expect(400);

    expect(res.body.fieldErrors.slug).toBeDefined();
  });

  it('409s creating a page whose slug is already used on that site/locale', async () => {
    const body = createPageBody({ slug: `taken-${randomUUID()}` });
    await agent.post('/pages').send(body).expect(201);

    await agent
      .post('/pages')
      .send(createPageBody({ slug: body.slug }))
      .expect(409);
  });

  it('sets and clears a page parent over HTTP', async () => {
    const parent = await agent
      .post('/pages')
      .send(createPageBody())
      .expect(201);
    const child = await agent.post('/pages').send(createPageBody()).expect(201);

    const setRes = await agent
      .patch(`/pages/${child.body.id}/parent`)
      .send({ parentId: parent.body.id })
      .expect(200);
    expect(setRes.body.parentId).toBe(parent.body.id);

    const clearRes = await agent
      .patch(`/pages/${child.body.id}/parent`)
      .send({ parentId: null })
      .expect(200);
    expect(clearRes.body.parentId).toBeNull();
  });

  it('400s setting a page as its own parent', async () => {
    const page = await agent.post('/pages').send(createPageBody()).expect(201);

    await agent
      .patch(`/pages/${page.body.id}/parent`)
      .send({ parentId: page.body.id })
      .expect(400);
  });

  it('400s setting a parent from a different locale', async () => {
    const enPage = await agent
      .post('/pages')
      .send(createPageBody({ locale: 'en', slug: `en-${randomUUID()}` }))
      .expect(201);
    const itPage = await agent
      .post('/pages')
      .send(createPageBody())
      .expect(201);

    await agent
      .patch(`/pages/${itPage.body.id}/parent`)
      .send({ parentId: enPage.body.id })
      .expect(400);
  });

  it('404s setting a parent to a page that does not exist', async () => {
    const page = await agent.post('/pages').send(createPageBody()).expect(201);

    await agent
      .patch(`/pages/${page.body.id}/parent`)
      .send({ parentId: randomUUID() })
      .expect(404);
  });

  it('deletes a page', async () => {
    const createRes = await agent
      .post('/pages')
      .send(createPageBody())
      .expect(201);

    await agent.delete(`/pages/${createRes.body.id}`).expect(204);
    await agent.get(`/pages/${createRes.body.id}`).expect(404);
  });

  it('404s deleting a page that does not exist', async () => {
    await agent.delete(`/pages/${randomUUID()}`).expect(404);
  });

  it('401s without a session cookie', async () => {
    await request(app.getHttpServer())
      .get(`/pages/${randomUUID()}`)
      .expect(401);
  });

  describe('publish role gating (Fase 5c)', () => {
    async function loginAs(role: 'admin' | 'publisher' | 'editor') {
      const tenantId = process.env.DEFAULT_TENANT_ID as string;
      const authPort = app.get<AuthPort>(AUTH_PORT);
      const email = `integration-${role}-${randomUUID()}@example.test`;
      const password = randomUUID();
      const passwordHash = await authPort.hashPassword(password);
      const [roleUser] = await withTenant(db, tenantId, (tx) =>
        tx
          .insert(users)
          .values({
            tenantId,
            email,
            passwordHash,
            role,
            displayName: `Integration ${role}`,
          })
          .returning({ id: users.id }),
      );
      createdUserIds.push(roleUser.id);
      const roleAgent = request.agent(app.getHttpServer());
      await roleAgent.post('/auth/login').send({ email, password }).expect(200);
      return { agent: roleAgent, email };
    }

    it('403s an editor publishing a page, but draft/save stays open to them', async () => {
      const created = await agent
        .post('/pages')
        .send(createPageBody())
        .expect(201);
      const pageId = created.body.id;
      const { agent: editorAgent } = await loginAs('editor');

      await editorAgent
        .patch(`/pages/${pageId}/draft`)
        .send({
          content: [{ type: 'Hero', props: { title: 'editor can draft' } }],
        })
        .expect(200);
      await editorAgent.post(`/pages/${pageId}/publish`).expect(403);
    });

    it('allows a publisher (not just admin) to publish', async () => {
      const created = await agent
        .post('/pages')
        .send(createPageBody())
        .expect(201);
      const pageId = created.body.id;
      const { agent: publisherAgent } = await loginAs('publisher');

      await publisherAgent.post(`/pages/${pageId}/publish`).expect(201);
    });

    it('deactivating a user invalidates its existing session on the very next guarded request, not just at next login', async () => {
      const created = await agent
        .post('/pages')
        .send(createPageBody())
        .expect(201);
      const pageId = created.body.id;
      const { agent: publisherAgent, email } = await loginAs('publisher');
      // sanity check: the session works before deactivation
      await publisherAgent.post(`/pages/${pageId}/publish`).expect(201);

      const tenantId = process.env.DEFAULT_TENANT_ID as string;
      const userRepository = app.get<UserRepositoryPort>(USER_REPOSITORY);
      const publisherUser = await userRepository.findByEmail(tenantId, email);
      publisherUser?.deactivate();
      if (publisherUser) {
        await userRepository.save(publisherUser);
      }

      const secondPage = await agent
        .post('/pages')
        .send(createPageBody())
        .expect(201);
      await publisherAgent
        .post(`/pages/${secondPage.body.id}/publish`)
        .expect(401);
    });
  });
});
