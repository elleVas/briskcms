import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { AuthPort } from '@brisk/ports';
import { type BriskDb, sites, users, withTenant } from '@brisk/postgres-db';
import { AUTH_PORT } from '../auth/auth.tokens.js';
import { DATABASE } from '../database.module.js';
import { SiteLayoutSectionsModule } from './site-layout-sections.module.js';

/**
 * Runs against a real Postgres, through the real HTTP stack — see
 * docs/development.md. Creates its own throwaway site + user under
 * DEFAULT_TENANT_ID in beforeAll, same reasoning as
 * pages.controller.integration.spec.ts (keeps this suite's data out of the
 * site the dev editor-app displays).
 */
describe('SiteLayoutSectionsController (integration)', () => {
  let app: INestApplication;
  let db: BriskDb;
  let agent: ReturnType<typeof request.agent>;
  let siteId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SiteLayoutSectionsModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    db = app.get<BriskDb>(DATABASE);

    const tenantId = process.env.DEFAULT_TENANT_ID as string;

    const [site] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(sites)
        .values({
          tenantId,
          name: `Integration Site ${randomUUID()}`,
          defaultLocale: 'it',
          enabledLocales: ['it', 'en'],
        })
        .returning({ id: sites.id }),
    );
    siteId = site.id;

    const authPort = app.get<AuthPort>(AUTH_PORT);
    const email = `integration-${randomUUID()}@example.test`;
    const password = randomUUID();
    const passwordHash = await authPort.hashPassword(password);
    await withTenant(db, tenantId, (tx) =>
      tx.insert(users).values({ tenantId, email, passwordHash, role: 'admin' }),
    );

    agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(200);
  });

  afterAll(async () => {
    await app.close();
    await db.$client.end();
  });

  it('runs the full get-or-create -> draft -> publish -> rollback cycle over HTTP', async () => {
    const locale = `it-${randomUUID()}`;
    const createRes = await agent
      .get('/site-layout-sections')
      .query({ siteId, locale, kind: 'header' })
      .expect(200);
    expect(createRes.body.status).toBe('draft');
    expect(createRes.body.content).toEqual([]);
    const id = createRes.body.id;

    const reused = await agent
      .get('/site-layout-sections')
      .query({ siteId, locale, kind: 'header' })
      .expect(200);
    expect(reused.body.id).toBe(id);

    const draftRes = await agent
      .patch(`/site-layout-sections/${id}/draft`)
      .send({ content: [{ type: 'Header', props: { v: 1 } }] })
      .expect(200);
    expect(draftRes.body.content).toEqual([
      { type: 'Header', props: { v: 1 } },
    ]);

    const publishRes = await agent
      .post(`/site-layout-sections/${id}/publish`)
      .expect(201);
    expect(publishRes.body.status).toBe('published');
    expect(publishRes.body.publishedContent).toEqual([
      { type: 'Header', props: { v: 1 } },
    ]);

    const versionsRes = await agent
      .get(`/site-layout-sections/${id}/versions`)
      .expect(200);
    expect(versionsRes.body).toHaveLength(1);
    const firstVersionId = versionsRes.body[0].id;

    await agent
      .patch(`/site-layout-sections/${id}/draft`)
      .send({ content: [{ type: 'Header', props: { v: 2 } }] })
      .expect(200);

    const rollbackRes = await agent
      .post(`/site-layout-sections/${id}/rollback`)
      .send({ versionId: firstVersionId })
      .expect(201);
    expect(rollbackRes.body.content).toEqual([
      { type: 'Header', props: { v: 1 } },
    ]);
    // rollback restores the draft only, the published copy is untouched
    expect(rollbackRes.body.publishedContent).toEqual([
      { type: 'Header', props: { v: 1 } },
    ]);

    const byId = await agent.get(`/site-layout-sections/${id}`).expect(200);
    expect(byId.body.id).toBe(id);
  });

  it('a new locale starts as a copy of the default locale content', async () => {
    const defaultRes = await agent
      .get('/site-layout-sections')
      .query({ siteId, locale: 'it', kind: 'footer' })
      .expect(200);
    await agent
      .patch(`/site-layout-sections/${defaultRes.body.id}/draft`)
      .send({ content: [{ type: 'Footer', props: { text: 'Ciao' } }] })
      .expect(200);
    await agent
      .post(`/site-layout-sections/${defaultRes.body.id}/publish`)
      .expect(201);

    const enRes = await agent
      .get('/site-layout-sections')
      .query({ siteId, locale: 'en', kind: 'footer' })
      .expect(200);

    expect(enRes.body.content).toEqual([
      { type: 'Footer', props: { text: 'Ciao' } },
    ]);
  });

  it('404s on a section that does not exist', async () => {
    await agent.get(`/site-layout-sections/${randomUUID()}`).expect(404);
  });

  it('404s getOrCreate for a site that does not exist', async () => {
    await agent
      .get('/site-layout-sections')
      .query({ siteId: randomUUID(), locale: 'it', kind: 'header' })
      .expect(404);
  });

  it('404s saving a draft for a section that does not exist', async () => {
    await agent
      .patch(`/site-layout-sections/${randomUUID()}/draft`)
      .send({ content: [] })
      .expect(404);
  });

  it('400s on an invalid kind query param instead of hitting the database', async () => {
    await agent
      .get('/site-layout-sections')
      .query({ siteId, locale: 'it', kind: 'not-a-kind' })
      .expect(400);
  });

  it('401s without a session cookie', async () => {
    await request(app.getHttpServer())
      .get(`/site-layout-sections/${randomUUID()}`)
      .expect(401);
  });
});
