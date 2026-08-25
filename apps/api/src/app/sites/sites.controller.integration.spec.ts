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
import { SitesModule } from './sites.module.js';

/**
 * Runs against a real Postgres, through the real HTTP stack — same
 * throwaway-site-under-DEFAULT_TENANT_ID isolation as
 * pages.controller.integration.spec.ts, and the same reasoning for it: a
 * shared dev-seed site would accumulate business-info edits across runs.
 */
describe('SitesController (integration)', () => {
  let app: INestApplication;
  let db: BriskDb;
  let agent: ReturnType<typeof request.agent>;
  let siteId: string;
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SitesModule],
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
    const email = `sites-integration-${randomUUID()}@example.test`;
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

  it('finds a site by id, with no business info yet', async () => {
    const res = await agent.get(`/sites/${siteId}`).expect(200);

    expect(res.body.businessAddress).toBeNull();
    expect(res.body.openingHours).toBeNull();
  });

  it('404s finding a site that does not exist', async () => {
    await agent.get(`/sites/${randomUUID()}`).expect(404);
  });

  it('updates business info, including multi-range opening hours', async () => {
    const res = await agent
      .patch(`/sites/${siteId}/business-info`)
      .send({
        businessAddress: 'Via Roma 1, Milano',
        businessPhone: '+39 02 1234567',
        businessType: 'Restaurant',
        openingHours: [
          {
            dayOfWeek: 'monday',
            ranges: [
              { opens: '12:00', closes: '14:30' },
              { opens: '19:00', closes: '23:00' },
            ],
          },
          { dayOfWeek: 'sunday', ranges: [] },
        ],
      })
      .expect(200);

    expect(res.body.businessAddress).toBe('Via Roma 1, Milano');
    expect(res.body.openingHours).toHaveLength(2);

    const getRes = await agent.get(`/sites/${siteId}`).expect(200);
    expect(getRes.body.businessPhone).toBe('+39 02 1234567');
  });

  it('400s an opening hours entry not in HH:MM format', async () => {
    await agent
      .patch(`/sites/${siteId}/business-info`)
      .send({
        businessAddress: null,
        businessPhone: null,
        businessType: null,
        openingHours: [
          { dayOfWeek: 'monday', ranges: [{ opens: '9am', closes: '13:00' }] },
        ],
      })
      .expect(400);
  });

  it('404s updating business info for a site that does not exist', async () => {
    await agent
      .patch(`/sites/${randomUUID()}/business-info`)
      .send({
        businessAddress: null,
        businessPhone: null,
        businessType: null,
        openingHours: null,
      })
      .expect(404);
  });

  it('updates general settings (name and domain)', async () => {
    const res = await agent
      .patch(`/sites/${siteId}/general-settings`)
      .send({ name: 'Il mio ristorante', domain: 'ilmioristorante.it' })
      .expect(200);

    expect(res.body.name).toBe('Il mio ristorante');
    expect(res.body.domain).toBe('ilmioristorante.it');

    const getRes = await agent.get(`/sites/${siteId}`).expect(200);
    expect(getRes.body.domain).toBe('ilmioristorante.it');
  });

  it('400s a domain that is not a valid hostname', async () => {
    await agent
      .patch(`/sites/${siteId}/general-settings`)
      .send({ name: 'x', domain: 'not a valid host!!' })
      .expect(400);
  });

  it('404s updating general settings for a site that does not exist', async () => {
    await agent
      .patch(`/sites/${randomUUID()}/general-settings`)
      .send({ name: 'x', domain: null })
      .expect(404);
  });

  it('defaults search engine indexing to disabled, and can be enabled', async () => {
    const getRes = await agent.get(`/sites/${siteId}`).expect(200);
    expect(getRes.body.searchEngineIndexingEnabled).toBe(false);

    const res = await agent
      .patch(`/sites/${siteId}/seo-settings`)
      .send({ searchEngineIndexingEnabled: true })
      .expect(200);

    expect(res.body.searchEngineIndexingEnabled).toBe(true);
  });

  it('404s updating SEO settings for a site that does not exist', async () => {
    await agent
      .patch(`/sites/${randomUUID()}/seo-settings`)
      .send({ searchEngineIndexingEnabled: true })
      .expect(404);
  });

  it('updates theme settings, persisted across the real HTTP+DB stack', async () => {
    const res = await agent
      .patch(`/sites/${siteId}/theme-settings`)
      .send({
        primaryColor: '#18181b',
        secondaryColor: '#71717a',
        fontFamily: 'inter',
        customCss: '.brisk-hero { text-transform: uppercase; }',
        headScript: null,
        bodyScript: null,
        faviconUrl: 'https://example.com/favicon.png',
        overridesEnabled: true,
      })
      .expect(200);

    expect(res.body.themePrimaryColor).toBe('#18181b');
    expect(res.body.themeFontFamily).toBe('inter');

    const getRes = await agent.get(`/sites/${siteId}`).expect(200);
    expect(getRes.body.themeSecondaryColor).toBe('#71717a');
    expect(getRes.body.themeCustomCss).toBe(
      '.brisk-hero { text-transform: uppercase; }',
    );
    expect(getRes.body.themeFaviconUrl).toBe('https://example.com/favicon.png');
  });

  it('defaults theme overrides to enabled, and can be turned off (docs/adr/0021 two-gate composition)', async () => {
    const getRes = await agent.get(`/sites/${siteId}`).expect(200);
    expect(getRes.body.themeOverridesEnabled).toBe(true);

    const res = await agent
      .patch(`/sites/${siteId}/theme-settings`)
      .send({
        primaryColor: null,
        secondaryColor: null,
        fontFamily: null,
        customCss: null,
        headScript: null,
        bodyScript: null,
        faviconUrl: null,
        overridesEnabled: false,
      })
      .expect(200);

    expect(res.body.themeOverridesEnabled).toBe(false);
  });

  it('400s an invalid hex color for theme settings', async () => {
    await agent
      .patch(`/sites/${siteId}/theme-settings`)
      .send({
        primaryColor: 'not-a-hex-color',
        secondaryColor: null,
        fontFamily: null,
        customCss: null,
        headScript: null,
        bodyScript: null,
        faviconUrl: null,
        overridesEnabled: true,
      })
      .expect(400);
  });

  it('404s updating theme settings for a site that does not exist', async () => {
    await agent
      .patch(`/sites/${randomUUID()}/theme-settings`)
      .send({
        primaryColor: null,
        secondaryColor: null,
        fontFamily: null,
        customCss: null,
        headScript: null,
        bodyScript: null,
        faviconUrl: null,
        overridesEnabled: true,
      })
      .expect(404);
  });

  it('defaults theme tokens to an empty blockStyles map, and updates the override for one block type', async () => {
    const getRes = await agent.get(`/sites/${siteId}`).expect(200);
    expect(getRes.body.themeTokens).toEqual({ blockStyles: {} });

    const res = await agent
      .patch(`/sites/${siteId}/theme-tokens`)
      .send({
        blockType: 'Button',
        style: { borderRadius: '9999px', paddingX: '1.5rem' },
      })
      .expect(200);

    expect(res.body.themeTokens).toEqual({
      blockStyles: { Button: { borderRadius: '9999px', paddingX: '1.5rem' } },
    });

    const getAfter = await agent.get(`/sites/${siteId}`).expect(200);
    expect(getAfter.body.themeTokens).toEqual({
      blockStyles: { Button: { borderRadius: '9999px', paddingX: '1.5rem' } },
    });
  });

  it('404s updating theme tokens for a site that does not exist', async () => {
    await agent
      .patch(`/sites/${randomUUID()}/theme-tokens`)
      .send({
        blockType: 'Button',
        style: { borderRadius: '6px' },
      })
      .expect(404);
  });

  it('401s without a session cookie', async () => {
    await request(app.getHttpServer()).get(`/sites/${siteId}`).expect(401);
  });
});
