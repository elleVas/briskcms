import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SiteLayoutSectionsModule } from '../site-layout-sections/site-layout-sections.module';
import { PublicSiteLayoutSectionsModule } from './public-site-layout-sections.module';
import { IntegrationApp } from '../../test/integration-app.test-fixture';

/**
 * Runs against a real Postgres — see docs/development.md. Combines
 * SiteLayoutSectionsModule (create/save a draft the normal, authenticated
 * way) with PublicSiteLayoutSectionsModule under test, then reads the
 * draft back through the public preview endpoint with NO session at all —
 * same "real visitor" verification as public-pages.controller.integration.spec.ts.
 */
describe('PublicSiteLayoutSectionsController (integration)', () => {
  let integration: IntegrationApp;
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;
  let siteId: string;

  beforeAll(async () => {
    integration = await IntegrationApp.start({
      imports: [SiteLayoutSectionsModule, PublicSiteLayoutSectionsModule],
    });
    app = integration.app;
    siteId = await integration.createSite();
    agent = await integration.login(await integration.createUser());
  });

  afterAll(async () => {
    await integration.close();
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
