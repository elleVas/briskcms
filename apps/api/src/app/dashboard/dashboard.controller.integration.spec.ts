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
  media,
  pageGroups,
  pageTranslations,
  sites,
  users,
  withTenant,
} from '@brisk/postgres-db';
import { AUTH_PORT } from '../auth/auth.tokens';
import { DATABASE } from '../database.module';
import { DashboardModule } from './dashboard.module';

/**
 * Runs against a real Postgres — see docs/development.md. Same
 * throwaway-site-under-DEFAULT_TENANT_ID isolation as
 * media.controller.integration.spec.ts.
 */
describe('DashboardController (integration)', () => {
  let app: INestApplication;
  let db: BriskDb;
  let agent: ReturnType<typeof request.agent>;
  let siteId: string;
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DashboardModule],
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
          defaultLocale: 'it',
        })
        .returning({ id: sites.id }),
    );
    siteId = site.id;

    const authPort = app.get<AuthPort>(AUTH_PORT);
    const email = `dashboard-integration-${randomUUID()}@example.test`;
    const password = randomUUID();
    const passwordHash = await authPort.hashPassword(password);
    const [user] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(users)
        .values({ tenantId, email, passwordHash, role: 'admin' })
        .returning({ id: users.id }),
    );
    userId = user.id;

    // Fixture data the assertions below read back through the endpoint —
    // one published page, one draft, one media file.
    const [group] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(pageGroups)
        .values({ tenantId, siteId })
        .returning({ id: pageGroups.id }),
    );
    await withTenant(db, tenantId, (tx) =>
      tx.insert(pageTranslations).values([
        {
          tenantId,
          siteId,
          pageGroupId: group.id,
          locale: 'it',
          slug: `pubblicata-${randomUUID()}`,
          status: 'published',
          seoMeta: { title: 'Pagina pubblicata', description: '' },
        },
      ]),
    );
    const [group2] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(pageGroups)
        .values({ tenantId, siteId })
        .returning({ id: pageGroups.id }),
    );
    await withTenant(db, tenantId, (tx) =>
      tx.insert(pageTranslations).values([
        {
          tenantId,
          siteId,
          pageGroupId: group2.id,
          locale: 'it',
          slug: `bozza-${randomUUID()}`,
          status: 'draft',
          seoMeta: { title: 'Pagina in bozza', description: '' },
        },
      ]),
    );
    await withTenant(db, tenantId, (tx) =>
      tx.insert(media).values({
        tenantId,
        siteId,
        filename: 'foto.jpg',
        storageKey: `key-${randomUUID()}`,
        storageProvider: 'local',
        mimeType: 'image/jpeg',
        size: 12345,
      }),
    );

    agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email, password, captchaToken: 'test-token' })
      .expect(200);
  });

  afterAll(async () => {
    await deleteIntegrationFixtures(db, tenantId, {
      siteIds: [siteId],
      userIds: [userId],
    });
    await app.close();
    await db.$client.end();
  });

  it('returns page/media stats and recent activity for the site', async () => {
    const res = await agent
      .get('/dashboard/stats')
      .query({ siteId })
      .expect(200);

    expect(res.body.pages.publishedCount).toBeGreaterThanOrEqual(1);
    expect(res.body.pages.draftCount).toBeGreaterThanOrEqual(1);
    expect(res.body.media.count).toBeGreaterThanOrEqual(1);
    expect(res.body.media.totalSizeBytes).toBeGreaterThanOrEqual(12345);
    expect(res.body.recentActivity.length).toBeGreaterThan(0);
    expect(res.body.recentActivity[0]).toHaveProperty('title');
    expect(res.body.recentActivity[0]).toHaveProperty('status');
  });

  it('400s with a missing or invalid siteId', async () => {
    await agent
      .get('/dashboard/stats')
      .query({ siteId: 'not-a-uuid' })
      .expect(400);
  });

  it('401s without a session cookie', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/stats')
      .query({ siteId })
      .expect(401);
  });
});
