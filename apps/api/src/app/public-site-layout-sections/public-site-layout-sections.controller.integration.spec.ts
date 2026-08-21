import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
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
import { AUTH_PORT } from '../auth/auth.tokens.js';
import { DATABASE } from '../database.module.js';
import { SiteLayoutSectionsModule } from '../site-layout-sections/site-layout-sections.module.js';
import { PublicSiteLayoutSectionsModule } from './public-site-layout-sections.module.js';

/**
 * Runs against a real Postgres — see docs/development.md. Combines
 * SiteLayoutSectionsModule (create/save a draft the normal, authenticated
 * way) with PublicSiteLayoutSectionsModule under test, then reads the
 * draft back through the public preview endpoint with NO session at all —
 * same "real visitor" verification as public-pages.controller.integration.spec.ts.
 */
describe('PublicSiteLayoutSectionsController (integration)', () => {
  let app: INestApplication;
  let db: BriskDb;
  let agent: ReturnType<typeof request.agent>;
  let siteId: string;
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SiteLayoutSectionsModule, PublicSiteLayoutSectionsModule],
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
    userId = user.id;

    agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(200);
  });

  afterAll(async () => {
    await deleteIntegrationFixtures(db, tenantId, {
      siteIds: [siteId],
      userIds: [userId],
    });
    await app.close();
    await db.$client.end();
  });

  it('serves the real draft, unpublished, behind a valid preview token — without a session', async () => {
    const locale = `it-${randomUUID()}`;
    const created = await agent
      .get('/site-layout-sections')
      .query({ siteId, locale, kind: 'header' })
      .expect(200);
    const id = created.body.id;
    await agent
      .patch(`/site-layout-sections/${id}/draft`)
      .send({ content: [{ type: 'Header', props: { label: 'bozza' } }] })
      .expect(200);
    // Deliberately never published.
    const tokenRes = await agent
      .post(`/site-layout-sections/${id}/preview-token`)
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/public/site-layout-sections/${id}/preview`)
      .query({ token: tokenRes.body.token })
      .expect(200);

    expect(res.body).toEqual({
      content: [{ type: 'Header', props: { label: 'bozza' } }],
      kind: 'header',
      sticky: false,
      locale,
    });
  });

  it('404s a preview request with a wrong/mismatched token', async () => {
    const locale = `it-${randomUUID()}`;
    const created = await agent
      .get('/site-layout-sections')
      .query({ siteId, locale, kind: 'footer' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/public/site-layout-sections/${created.body.id}/preview`)
      .query({ token: 'not-a-real-token' })
      .expect(404);
  });

  it('404s a preview request whose token was issued for the other kind (header vs footer) on the same site+locale', async () => {
    const locale = `it-${randomUUID()}`;
    const header = await agent
      .get('/site-layout-sections')
      .query({ siteId, locale, kind: 'header' })
      .expect(200);
    const footer = await agent
      .get('/site-layout-sections')
      .query({ siteId, locale, kind: 'footer' })
      .expect(200);
    const footerToken = await agent
      .post(`/site-layout-sections/${footer.body.id}/preview-token`)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/public/site-layout-sections/${header.body.id}/preview`)
      .query({ token: footerToken.body.token })
      .expect(404);
  });

  it('404s for a section id that does not exist', async () => {
    await request(app.getHttpServer())
      .get(`/public/site-layout-sections/${randomUUID()}/preview`)
      .query({ token: 'irrelevant' })
      .expect(404);
  });
});
