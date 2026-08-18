import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { BriskDb } from '@brisk/postgres-db';
import { DATABASE } from '../database.module.js';
import { PagesModule } from './pages.module.js';

/**
 * Runs against a real Postgres, through the real HTTP stack — see
 * docs/development.md ("docker compose up -d postgres", run migrations,
 * then `pnpm --filter @brisk/postgres-db run db:seed` so DEFAULT_TENANT_ID/
 * DEFAULT_SITE_ID/DEFAULT_USER_EMAIL/DEFAULT_USER_PASSWORD all exist).
 * Every route requires a session (see docs/adr/0010) — logs in once via a
 * cookie-persisting supertest agent, shared across every test below.
 */
describe('PagesController (integration)', () => {
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;
  const siteId = process.env.DEFAULT_SITE_ID as string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PagesModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({
        email: process.env.DEFAULT_USER_EMAIL,
        password: process.env.DEFAULT_USER_PASSWORD,
      })
      .expect(200);
  });

  afterAll(async () => {
    const db = app.get<BriskDb>(DATABASE);
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

    const res = await agent.get('/pages').query({ siteId }).expect(200);

    const ids = res.body.map((page: { id: string }) => page.id);
    expect(ids).toEqual(
      expect.arrayContaining([first.body.id, second.body.id]),
    );
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
});
