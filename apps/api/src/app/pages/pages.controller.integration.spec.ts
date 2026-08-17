import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { BriskDb } from '@brisk/postgres-db';
import { PagesModule } from './pages.module.js';
import { DATABASE } from './pages.tokens.js';

/**
 * Runs against a real Postgres, through the real HTTP stack — see
 * docs/development.md ("docker compose up -d postgres", run migrations,
 * then `pnpm --filter @brisk/postgres-db run db:seed` so DEFAULT_TENANT_ID/
 * DEFAULT_SITE_ID exist).
 */
describe('PagesController (integration)', () => {
  let app: INestApplication;
  const siteId = process.env.DEFAULT_SITE_ID as string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PagesModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
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
    const createRes = await request(app.getHttpServer())
      .post('/pages')
      .send(createPageBody())
      .expect(201);

    expect(createRes.body.status).toBe('draft');
    expect(createRes.body.publishedContent).toBeNull();
    const pageId = createRes.body.id;

    const draftRes = await request(app.getHttpServer())
      .patch(`/pages/${pageId}/draft`)
      .send({ content: [{ type: 'Hero', props: { title: 'v1' } }] })
      .expect(200);
    expect(draftRes.body.content).toEqual([
      { type: 'Hero', props: { title: 'v1' } },
    ]);

    const publishRes = await request(app.getHttpServer())
      .post(`/pages/${pageId}/publish`)
      .expect(201);
    expect(publishRes.body.status).toBe('published');
    expect(publishRes.body.publishedContent).toEqual([
      { type: 'Hero', props: { title: 'v1' } },
    ]);

    const versionsRes = await request(app.getHttpServer())
      .get(`/pages/${pageId}/versions`)
      .expect(200);
    expect(versionsRes.body).toHaveLength(2); // create, draft v1
    const firstVersionId = versionsRes.body[0].id;

    const rollbackRes = await request(app.getHttpServer())
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
    const createRes = await request(app.getHttpServer())
      .post('/pages')
      .send(body)
      .expect(201);

    const byId = await request(app.getHttpServer())
      .get(`/pages/${createRes.body.id}`)
      .expect(200);
    const bySlug = await request(app.getHttpServer())
      .get('/pages/by-slug')
      .query({ siteId, locale: body.locale, slug: body.slug })
      .expect(200);

    expect(byId.body.id).toBe(createRes.body.id);
    expect(bySlug.body.id).toBe(createRes.body.id);
  });

  it('404s on a page that does not exist', async () => {
    await request(app.getHttpServer())
      .get(`/pages/${randomUUID()}`)
      .expect(404);
  });

  it('400s on an invalid create body instead of hitting the database', async () => {
    const res = await request(app.getHttpServer())
      .post('/pages')
      .send({ siteId: 'not-a-uuid' })
      .expect(400);

    expect(res.body.fieldErrors.siteId).toBeDefined();
  });
});
