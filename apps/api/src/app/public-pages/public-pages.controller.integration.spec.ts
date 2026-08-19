import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { AuthPort } from '@brisk/ports';
import { type BriskDb, sites, users, withTenant } from '@brisk/postgres-db';
import { AUTH_PORT } from '../auth/auth.tokens.js';
import { DATABASE } from '../database.module.js';
import { PagesModule } from '../pages/pages.module.js';
import { SiteLayoutSectionsModule } from '../site-layout-sections/site-layout-sections.module.js';
import { PublicPagesModule } from './public-pages.module.js';

/**
 * Runs against a real Postgres — see docs/development.md. Combines
 * PagesModule (to create/publish pages the normal, authenticated way) with
 * PublicPagesModule under test, then reads them back through the public
 * endpoint with NO session at all — that's the actual thing being verified:
 * a real visitor, not the admin agent, can reach published content and
 * nothing else.
 *
 * Uses its own throwaway site under DEFAULT_TENANT_ID, same reasoning as
 * pages.controller.integration.spec.ts: keeps this suite's data out of the
 * site the dev editor-app displays.
 */
describe('PublicPagesController (integration)', () => {
  let app: INestApplication;
  let db: BriskDb;
  let agent: ReturnType<typeof request.agent>;
  let siteId: string;
  let domain: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PagesModule, SiteLayoutSectionsModule, PublicPagesModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    db = app.get<BriskDb>(DATABASE);

    const tenantId = process.env.DEFAULT_TENANT_ID as string;
    domain = `public-test-${randomUUID()}.example.test`;

    const [site] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(sites)
        .values({
          tenantId,
          name: 'Public Test Site',
          domain,
          defaultLocale: 'it',
          enabledLocales: ['it'],
        })
        .returning({ id: sites.id }),
    );
    siteId = site.id;

    const authPort = app.get<AuthPort>(AUTH_PORT);
    const email = `public-integration-${randomUUID()}@example.test`;
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

  it('serves published content for a slug on the matching domain, without a session', async () => {
    const createRes = await agent
      .post('/pages')
      .send({
        siteId,
        groupId: randomUUID(),
        locale: 'it',
        slug: 'chi-siamo',
        seoMeta: { title: 'Chi siamo', description: 'La nostra storia' },
      })
      .expect(201);
    await agent
      .patch(`/pages/${createRes.body.id}/draft`)
      .send({ content: [{ type: 'Hero', props: { title: 'Ciao' } }] })
      .expect(200);
    await agent.post(`/pages/${createRes.body.id}/publish`).expect(201);

    const res = await request(app.getHttpServer())
      .get('/public/pages/by-slug')
      .query({ domain, locale: 'it', slug: 'chi-siamo' })
      .expect(200);

    expect(res.body).toEqual({
      content: [{ type: 'Hero', props: { title: 'Ciao' } }],
      seoMeta: { title: 'Chi siamo', description: 'La nostra storia' },
      locale: 'it',
      translations: [{ locale: 'it', slug: 'chi-siamo' }],
      header: null,
      footer: null,
      site: {
        name: 'Public Test Site',
        domain,
        defaultLocale: 'it',
        enabledLocales: ['it'],
        untranslatedPageFallback: 'redirect-to-default',
        businessAddress: null,
        businessPhone: null,
        businessType: null,
        openingHours: null,
        searchEngineIndexingEnabled: false,
      },
    });
  });

  it("bundles the published header/footer for the page's (site, locale), without a session", async () => {
    const createRes = await agent
      .post('/pages')
      .send({
        siteId,
        groupId: randomUUID(),
        locale: 'it',
        slug: 'con-header',
        seoMeta: { title: 'Con header', description: '' },
      })
      .expect(201);
    await agent.post(`/pages/${createRes.body.id}/publish`).expect(201);

    const headerRes = await agent
      .get('/site-layout-sections')
      .query({ siteId, locale: 'it', kind: 'header' })
      .expect(200);
    await agent
      .patch(`/site-layout-sections/${headerRes.body.id}/draft`)
      .send({ content: [{ type: 'Header', props: {} }] })
      .expect(200);
    await agent
      .post(`/site-layout-sections/${headerRes.body.id}/publish`)
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/public/pages/by-slug')
      .query({ domain, locale: 'it', slug: 'con-header' })
      .expect(200);

    expect(res.body.header).toEqual([{ type: 'Header', props: {} }]);
    expect(res.body.footer).toBeNull();
  });

  it('404s for a page that has never been published, same as a nonexistent one', async () => {
    await agent
      .post('/pages')
      .send({
        siteId,
        groupId: randomUUID(),
        locale: 'it',
        slug: 'bozza-mai-pubblicata',
        seoMeta: { title: 'Bozza', description: '' },
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/public/pages/by-slug')
      .query({ domain, locale: 'it', slug: 'bozza-mai-pubblicata' })
      .expect(404);
  });

  it('404s for a slug that does not exist', async () => {
    await request(app.getHttpServer())
      .get('/public/pages/by-slug')
      .query({ domain, locale: 'it', slug: 'non-esiste-proprio' })
      .expect(404);
  });

  it('404s for a domain that does not match any site', async () => {
    await request(app.getHttpServer())
      .get('/public/pages/by-slug')
      .query({
        domain: 'nobody-owns-this-domain.test',
        locale: 'it',
        slug: 'chi-siamo',
      })
      .expect(404);
  });

  it('400s on a malformed domain instead of hitting the database', async () => {
    await request(app.getHttpServer())
      .get('/public/pages/by-slug')
      .query({ domain: 'not a valid host!!', locale: 'it', slug: 'chi-siamo' })
      .expect(400);
  });

  it('lists only published pages for the sitemap, skipping drafts, without a session', async () => {
    await agent
      .post('/pages')
      .send({
        siteId,
        groupId: randomUUID(),
        locale: 'it',
        slug: 'sitemap-bozza',
        seoMeta: { title: 'Bozza', description: '' },
      })
      .expect(201);

    const publishedRes = await agent
      .post('/pages')
      .send({
        siteId,
        groupId: randomUUID(),
        locale: 'it',
        slug: 'sitemap-pubblicata',
        seoMeta: { title: 'Pubblicata', description: '' },
      })
      .expect(201);
    await agent.post(`/pages/${publishedRes.body.id}/publish`).expect(201);

    const res = await request(app.getHttpServer())
      .get('/public/pages')
      .query({ domain })
      .expect(200);

    const slugs = res.body.items.map((item: { slug: string }) => item.slug);
    expect(slugs).toContain('sitemap-pubblicata');
    expect(slugs).not.toContain('sitemap-bozza');
    expect(res.body.searchEngineIndexingEnabled).toBe(false);
  });

  it('returns an empty, indexing-allowed list for a domain that matches no site', async () => {
    const res = await request(app.getHttpServer())
      .get('/public/pages')
      .query({ domain: 'nobody-owns-this-domain.test' })
      .expect(200);

    expect(res.body).toEqual({
      items: [],
      searchEngineIndexingEnabled: true,
      defaultLocale: 'it',
    });
  });
});
