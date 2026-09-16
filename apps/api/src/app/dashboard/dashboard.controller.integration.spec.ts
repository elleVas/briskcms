import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  type BriskDb,
  media,
  pageGroups,
  pageTranslations,
  withTenant,
} from '@brisk/postgres-db';
import { DashboardModule } from './dashboard.module';
import { IntegrationApp } from '../../test/integration-app.test-fixture';

/**
 * Runs against a real Postgres — see docs/development.md. Same
 * throwaway-site-under-DEFAULT_TENANT_ID isolation as
 * media.controller.integration.spec.ts.
 */
describe('DashboardController (integration)', () => {
  let integration: IntegrationApp;
  let app: INestApplication;
  let db: BriskDb;
  let tenantId: string;
  let agent: ReturnType<typeof request.agent>;
  let siteId: string;

  beforeAll(async () => {
    integration = await IntegrationApp.start({ imports: [DashboardModule] });
    app = integration.app;
    ({ db, tenantId } = integration);
    siteId = await integration.createSite();

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

    agent = await integration.login(await integration.createUser());
  });

  afterAll(async () => {
    await integration.close();
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
