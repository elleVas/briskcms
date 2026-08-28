import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HttpExceptionFilter } from '../http-exception.filter.js';
import { requestIdMiddleware } from '../request-id.middleware.js';
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
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PagesModule, SiteLayoutSectionsModule, PublicPagesModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.use(requestIdMiddleware);
    await app.init();
    db = app.get<BriskDb>(DATABASE);

    tenantId = process.env.DEFAULT_TENANT_ID as string;
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
    const [user] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(users)
        .values({ tenantId, email, passwordHash, role: 'admin' })
        .returning({ id: users.id }),
    );
    userId = user.id;

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
      .query({ domain, locale: 'it', path: 'chi-siamo' })
      .expect(200);

    expect(res.body).toEqual({
      content: [{ type: 'Hero', props: { title: 'Ciao' } }],
      seoMeta: { title: 'Chi siamo', description: 'La nostra storia' },
      locale: 'it',
      translations: [{ locale: 'it', slug: 'chi-siamo' }],
      ancestors: [],
      header: null,
      footer: null,
      headerSticky: false,
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
        themeSettings: {
          primaryColor: null,
          secondaryColor: null,
          fontFamily: null,
          customCss: null,
          headScript: null,
          bodyScript: null,
          faviconUrl: null,
          overridesEnabled: true,
        },
        themeTokens: {
          blockStyles: {},
        },
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
      .query({ domain, locale: 'it', path: 'con-header' })
      .expect(200);

    expect(res.body.header).toEqual([{ type: 'Header', props: {} }]);
    expect(res.body.footer).toBeNull();
    expect(res.body.headerSticky).toBe(false);
  });

  it('propagates a published sticky header over the public HTTP endpoint', async () => {
    const createRes = await agent
      .post('/pages')
      .send({
        siteId,
        groupId: randomUUID(),
        locale: 'it',
        slug: 'con-header-sticky',
        seoMeta: { title: 'Con header sticky', description: '' },
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
    await agent
      .patch(`/site-layout-sections/${headerRes.body.id}/sticky`)
      .send({ sticky: true })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/public/pages/by-slug')
      .query({ domain, locale: 'it', path: 'con-header-sticky' })
      .expect(200);

    expect(res.body.headerSticky).toBe(true);
  });

  it('/public/pages/chrome bundles the published header/footer with no page in the picture', async () => {
    // Fresh locale, not 'it' — a page-less route can't inherit header/
    // footer state other tests in this file already published at 'it'.
    const locale = `it-${randomUUID()}`;
    const headerRes = await agent
      .get('/site-layout-sections')
      .query({ siteId, locale, kind: 'header' })
      .expect(200);
    await agent
      .patch(`/site-layout-sections/${headerRes.body.id}/draft`)
      .send({ content: [{ type: 'Header', props: {} }] })
      .expect(200);
    await agent
      .post(`/site-layout-sections/${headerRes.body.id}/publish`)
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/public/pages/chrome')
      .query({ domain, locale })
      .expect(200);

    expect(res.body.header).toEqual([{ type: 'Header', props: {} }]);
    expect(res.body.footer).toBeNull();
    expect(res.body.site.name).toBe('Public Test Site');
  });

  it("/public/pages/chrome falls back to the site's default locale (it) header/footer for a locale with nothing of its own configured", async () => {
    // Regression: a locale that never got its own header/footer section
    // used to render with NEITHER (found live on a real multi-locale site —
    // the English page lost its nav and footer entirely). The site's own
    // 'it' header is (re)published here with a distinctive payload so this
    // assertion is self-contained, independent of what any earlier test in
    // this file left behind at 'it'.
    const headerRes = await agent
      .get('/site-layout-sections')
      .query({ siteId, locale: 'it', kind: 'header' })
      .expect(200);
    await agent
      .patch(`/site-layout-sections/${headerRes.body.id}/draft`)
      .send({ content: [{ type: 'Header', props: { fallbackCheck: true } }] })
      .expect(200);
    await agent
      .post(`/site-layout-sections/${headerRes.body.id}/publish`)
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/public/pages/chrome')
      .query({ domain, locale: `it-${randomUUID()}` })
      .expect(200);

    expect(res.body.header).toEqual([
      { type: 'Header', props: { fallbackCheck: true } },
    ]);
  });

  it('/public/pages/chrome 404s for a domain that does not match any site', async () => {
    await request(app.getHttpServer())
      .get('/public/pages/chrome')
      .query({ domain: 'nobody-has-this.example.test', locale: 'it' })
      .expect(404);
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
      .query({ domain, locale: 'it', path: 'bozza-mai-pubblicata' })
      .expect(404);
  });

  it('404s for a slug that does not exist', async () => {
    await request(app.getHttpServer())
      .get('/public/pages/by-slug')
      .query({ domain, locale: 'it', path: 'non-esiste-proprio' })
      .expect(404);
  });

  // Regression: this is exactly the "fallback linguistico ingannevole" the
  // security review flagged — untranslatedPageFallback defaults to
  // 'redirect-to-default' (schema.ts), but nothing consumed it for direct
  // navigation/crawlers, only the language switcher (which needs a page to
  // already be found). A locale never enabled on this test site still
  // resolves the fallback: it's a same-slug/default-locale lookup, not
  // gated on enabledLocales (that list only decides what the switcher
  // renders as a link).
  it('404s with the default-locale fallback in the body for a locale that was never translated', async () => {
    const createRes = await agent
      .post('/pages')
      .send({
        siteId,
        groupId: randomUUID(),
        locale: 'it',
        slug: 'chi-siamo-fallback',
        seoMeta: { title: 'Chi siamo', description: '' },
      })
      .expect(201);
    await agent
      .patch(`/pages/${createRes.body.id}/draft`)
      .send({ content: [{ type: 'Hero', props: { title: 'Ciao' } }] })
      .expect(200);
    await agent.post(`/pages/${createRes.body.id}/publish`).expect(201);

    const res = await request(app.getHttpServer())
      .get('/public/pages/by-slug')
      .query({ domain, locale: 'en', path: 'chi-siamo-fallback' })
      .expect(404);

    expect(res.body.fallback).toEqual({
      locale: 'it',
      segments: ['chi-siamo-fallback'],
    });
  });

  it('404s with fallback: null when there is no default-locale page with that slug either', async () => {
    const res = await request(app.getHttpServer())
      .get('/public/pages/by-slug')
      .query({
        domain,
        locale: 'en',
        path: 'davvero-non-esiste-da-nessuna-parte',
      })
      .expect(404);

    expect(res.body.fallback).toBeNull();
  });

  it('404s for a domain that does not match any site', async () => {
    await request(app.getHttpServer())
      .get('/public/pages/by-slug')
      .query({
        domain: 'nobody-owns-this-domain.test',
        locale: 'it',
        path: 'chi-siamo',
      })
      .expect(404);
  });

  it('400s on a malformed domain instead of hitting the database', async () => {
    await request(app.getHttpServer())
      .get('/public/pages/by-slug')
      .query({ domain: 'not a valid host!!', locale: 'it', path: 'chi-siamo' })
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

  describe('preview', () => {
    it('serves the real draft, unpublished, behind a valid preview token — without a session', async () => {
      const createRes = await agent
        .post('/pages')
        .send({
          siteId,
          groupId: randomUUID(),
          locale: 'it',
          slug: `preview-${randomUUID()}`,
          seoMeta: { title: 'In lavorazione', description: '...' },
        })
        .expect(201);
      const pageId = createRes.body.id;
      await agent
        .patch(`/pages/${pageId}/draft`)
        .send({ content: [{ type: 'Hero', props: { title: 'Bozza' } }] })
        .expect(200);
      // Deliberately never published.
      const tokenRes = await agent
        .post(`/pages/${pageId}/preview-token`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/public/pages/${pageId}/preview`)
        .query({ token: tokenRes.body.token })
        .expect(200);

      expect(res.body.content).toEqual([
        { type: 'Hero', props: { title: 'Bozza' } },
      ]);
    });

    it('404s a preview request with a wrong/mismatched token', async () => {
      const createRes = await agent
        .post('/pages')
        .send({
          siteId,
          groupId: randomUUID(),
          locale: 'it',
          slug: `preview-${randomUUID()}`,
          seoMeta: { title: 'In lavorazione', description: '...' },
        })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/public/pages/${createRes.body.id}/preview`)
        .query({ token: 'not-a-real-token' })
        .expect(404);
    });

    it('404s a preview request whose token belongs to a different page', async () => {
      const first = await agent
        .post('/pages')
        .send({
          siteId,
          groupId: randomUUID(),
          locale: 'it',
          slug: `preview-${randomUUID()}`,
          seoMeta: { title: 'Prima', description: '...' },
        })
        .expect(201);
      const second = await agent
        .post('/pages')
        .send({
          siteId,
          groupId: randomUUID(),
          locale: 'it',
          slug: `preview-${randomUUID()}`,
          seoMeta: { title: 'Seconda', description: '...' },
        })
        .expect(201);
      const tokenForFirst = await agent
        .post(`/pages/${first.body.id}/preview-token`)
        .expect(201);

      await request(app.getHttpServer())
        .get(`/public/pages/${second.body.id}/preview`)
        .query({ token: tokenForFirst.body.token })
        .expect(404);
    });
  });
});
