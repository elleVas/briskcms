import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HttpExceptionFilter } from '../http-exception.filter';
import { requestIdMiddleware } from '../request-id.middleware';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { AuthPort } from '@brisk/ports';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';
import {
  type BriskDb,
  deleteIntegrationFixtures,
  sites,
  users,
  withTenant,
} from '@brisk/postgres-db';
import { AUTH_PORT } from '../auth/auth.tokens';
import { DATABASE } from '../database.module';
import { PagesModule } from '../pages/pages.module';
import { SiteLayoutSectionsModule } from '../site-layout-sections/site-layout-sections.module';
import { PublicPagesModule } from './public-pages.module';

/**
 * Runs against a real Postgres — see docs/development.md. Combines
 * PagesModule (to create/publish page GROUPS the normal, authenticated way
 * — via /page-groups, i18n a livello di campo, see the plan) with
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

  /** Creates a group + one 'it' translation, publishes it, returns both ids. */
  async function createAndPublishPage(
    slug: string,
    content: unknown[] = [],
    title = 'Title',
  ) {
    const groupRes = await agent
      .post('/page-groups')
      .send({ siteId, content })
      .expect(201);
    const translationRes = await agent
      .post(`/page-groups/${groupRes.body.id}/translations`)
      .send({ locale: 'it', slug, seoMeta: { title, description: '' } })
      .expect(201);
    await agent
      .post(`/page-groups/translations/${translationRes.body.id}/publish`)
      .expect(201);
    return { groupId: groupRes.body.id, translationId: translationRes.body.id };
  }

  it('serves published content for a slug on the matching domain, without a session', async () => {
    await createAndPublishPage(
      'chi-siamo',
      [{ type: 'Hero', props: { title: 'Ciao' } }],
      'Chi siamo',
    );

    const res = await request(app.getHttpServer())
      .get('/public/pages/by-slug')
      .query({ domain, locale: 'it', path: 'chi-siamo' })
      .expect(200);

    expect(res.body).toEqual({
      content: [{ type: 'Hero', props: { title: 'Ciao' } }],
      seoMeta: { title: 'Chi siamo', description: '' },
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
          allowedTrackerDomains: [],
          trackerScripts: [],
        },
        themeTokens: {
          blockStyles: {},
        },
        cookieBannerSettings: DEFAULT_COOKIE_BANNER_SETTINGS,
        privacyPolicySlug: null,
        cookiePolicySlug: null,
      },
    });
  });

  it("resolves a NavLink's page reference to the CURRENT locale's own path over the real public HTTP endpoint", async () => {
    // Real bug, found live during this session's own investigation: `page`
    // isn't a translatable field, so a locale-specific slug baked in at
    // pick time got reused verbatim for every locale of the containing
    // block — an IT reader could get an EN link. `page` is now
    // locale-independent ({pageGroupId, title}), resolved fresh for
    // whichever locale is actually being rendered.
    const docsGroupRes = await agent
      .post('/page-groups')
      .send({ siteId, content: [] })
      .expect(201);
    const docsItRes = await agent
      .post(`/page-groups/${docsGroupRes.body.id}/translations`)
      .send({
        locale: 'it',
        slug: 'documentazione',
        seoMeta: { title: 'Documentazione', description: '' },
      })
      .expect(201);
    await agent
      .post(`/page-groups/translations/${docsItRes.body.id}/publish`)
      .expect(201);
    const docsEnRes = await agent
      .post(`/page-groups/${docsGroupRes.body.id}/translations`)
      .send({
        locale: 'en',
        slug: 'docs',
        seoMeta: { title: 'Docs', description: '' },
      })
      .expect(201);
    await agent
      .post(`/page-groups/translations/${docsEnRes.body.id}/publish`)
      .expect(201);

    const homeGroupRes = await agent
      .post('/page-groups')
      .send({
        siteId,
        content: [
          {
            id: 'nav-1',
            type: 'NavLink',
            props: {
              label: 'Docs',
              linkType: 'page',
              page: {
                pageGroupId: docsGroupRes.body.id,
                title: 'Documentazione',
              },
              url: '',
            },
          },
        ],
      })
      .expect(201);
    const homeItRes = await agent
      .post(`/page-groups/${homeGroupRes.body.id}/translations`)
      .send({
        locale: 'it',
        slug: `home-it-${randomUUID()}`,
        seoMeta: { title: 'Home', description: '' },
      })
      .expect(201);
    await agent
      .post(`/page-groups/translations/${homeItRes.body.id}/publish`)
      .expect(201);
    const homeEnRes = await agent
      .post(`/page-groups/${homeGroupRes.body.id}/translations`)
      .send({
        locale: 'en',
        slug: `home-en-${randomUUID()}`,
        seoMeta: { title: 'Home', description: '' },
      })
      .expect(201);
    await agent
      .post(`/page-groups/translations/${homeEnRes.body.id}/publish`)
      .expect(201);

    const itRes = await request(app.getHttpServer())
      .get('/public/pages/by-slug')
      .query({ domain, locale: 'it', path: homeItRes.body.slug })
      .expect(200);
    const enRes = await request(app.getHttpServer())
      .get('/public/pages/by-slug')
      .query({ domain, locale: 'en', path: homeEnRes.body.slug })
      .expect(200);

    expect(itRes.body.content[0].props.page).toMatchObject({
      locale: 'it',
      slug: 'documentazione',
    });
    expect(enRes.body.content[0].props.page).toMatchObject({
      locale: 'en',
      slug: 'docs',
    });
  });

  it("bundles the published header/footer for the page's (site, locale), without a session", async () => {
    await createAndPublishPage('con-header', [], 'Con header');

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
    await createAndPublishPage('con-header-sticky', [], 'Con header sticky');

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
    const groupRes = await agent
      .post('/page-groups')
      .send({ siteId, content: [] })
      .expect(201);
    await agent
      .post(`/page-groups/${groupRes.body.id}/translations`)
      .send({
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

  // Regression, later revised: an earlier version of this fallback did NOT
  // check `enabledLocales` at all — any string in the locale segment
  // triggered a same-slug/default-locale lookup, "helpfully" redirecting
  // even a locale that was never real for this site. That broke
  // [locale]/index.astro specifically: since a "home" page exists on
  // nearly every site, ANY made-up first path segment (not just a real,
  // disabled locale) silently redirected to the homepage instead of
  // 404ing — found live-testing a themed 404 page. The rule is now
  // unconditional: a locale not in `site.enabledLocales` never gets a
  // fallback, whether it's a real language code that was removed or pure
  // garbage — a clean 404 either way (see
  // resolve-untranslated-page-fallback.spec.ts for the still-legitimate
  // case this doesn't affect: an ENABLED locale with no translation for
  // one specific page falls back to the default locale's same page).
  it('404s with fallback: null for a locale never enabled on this site, even if the same slug exists under the default locale', async () => {
    await createAndPublishPage(
      'chi-siamo-fallback',
      [{ type: 'Hero', props: { title: 'Ciao' } }],
      'Chi siamo',
    );

    const res = await request(app.getHttpServer())
      .get('/public/pages/by-slug')
      .query({ domain, locale: 'en', path: 'chi-siamo-fallback' })
      .expect(404);

    expect(res.body.fallback).toBeNull();
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
    const draftGroupRes = await agent
      .post('/page-groups')
      .send({ siteId, content: [] })
      .expect(201);
    await agent
      .post(`/page-groups/${draftGroupRes.body.id}/translations`)
      .send({
        locale: 'it',
        slug: 'sitemap-bozza',
        seoMeta: { title: 'Bozza', description: '' },
      })
      .expect(201);

    await createAndPublishPage('sitemap-pubblicata', [], 'Pubblicata');

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
      const groupRes = await agent
        .post('/page-groups')
        .send({
          siteId,
          content: [{ type: 'Hero', props: { title: 'Bozza' } }],
        })
        .expect(201);
      const translationRes = await agent
        .post(`/page-groups/${groupRes.body.id}/translations`)
        .send({
          locale: 'it',
          slug: `preview-${randomUUID()}`,
          seoMeta: { title: 'In lavorazione', description: '...' },
        })
        .expect(201);
      const translationId = translationRes.body.id;
      // Deliberately never published.
      const tokenRes = await agent
        .post(`/page-groups/translations/${translationId}/preview-token`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/public/pages/${translationId}/preview`)
        .query({ token: tokenRes.body.token })
        .expect(200);

      expect(res.body.content).toEqual([
        { type: 'Hero', props: { title: 'Bozza' } },
      ]);
    });

    it('404s a preview request with a wrong/mismatched token', async () => {
      const groupRes = await agent
        .post('/page-groups')
        .send({ siteId, content: [] })
        .expect(201);
      const translationRes = await agent
        .post(`/page-groups/${groupRes.body.id}/translations`)
        .send({
          locale: 'it',
          slug: `preview-${randomUUID()}`,
          seoMeta: { title: 'In lavorazione', description: '...' },
        })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/public/pages/${translationRes.body.id}/preview`)
        .query({ token: 'not-a-real-token' })
        .expect(404);
    });

    it('404s a preview request whose token belongs to a different page', async () => {
      const groupRes = await agent
        .post('/page-groups')
        .send({ siteId, content: [] })
        .expect(201);
      const first = await agent
        .post(`/page-groups/${groupRes.body.id}/translations`)
        .send({
          locale: 'it',
          slug: `preview-${randomUUID()}`,
          seoMeta: { title: 'Prima', description: '...' },
        })
        .expect(201);
      const second = await agent
        .post(`/page-groups/${groupRes.body.id}/translations`)
        .send({
          locale: 'en',
          slug: `preview-${randomUUID()}`,
          seoMeta: { title: 'Seconda', description: '...' },
        })
        .expect(201);
      const tokenForFirst = await agent
        .post(`/page-groups/translations/${first.body.id}/preview-token`)
        .expect(201);

      await request(app.getHttpServer())
        .get(`/public/pages/${second.body.id}/preview`)
        .query({ token: tokenForFirst.body.token })
        .expect(404);
    });
  });
});
