import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { AuthPort } from '@brisk/ports';
import { type BriskDb, sites, users, withTenant } from '@brisk/postgres-db';
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SitesModule],
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
        })
        .returning({ id: sites.id }),
    );
    siteId = site.id;

    const authPort = app.get<AuthPort>(AUTH_PORT);
    const email = `sites-integration-${randomUUID()}@example.test`;
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

  it('401s without a session cookie', async () => {
    await request(app.getHttpServer()).get(`/sites/${siteId}`).expect(401);
  });
});
