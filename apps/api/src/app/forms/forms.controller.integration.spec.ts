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
import { FormsModule } from './forms.module.js';

/**
 * Runs against a real Postgres — see docs/development.md. Same
 * throwaway-site-under-DEFAULT_TENANT_ID isolation as
 * pages.controller.integration.spec.ts.
 */
describe('FormsController (integration)', () => {
  let app: INestApplication;
  let db: BriskDb;
  let agent: ReturnType<typeof request.agent>;
  let siteId: string;
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FormsModule],
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
          name: `Forms Integration Site ${randomUUID()}`,
          defaultLocale: 'it',
        })
        .returning({ id: sites.id }),
    );
    siteId = site.id;

    const authPort = app.get<AuthPort>(AUTH_PORT);
    const email = `forms-integration-${randomUUID()}@example.test`;
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

  it('creates, reads, updates, lists and deletes a form', async () => {
    const createRes = await agent
      .post('/forms')
      .send({ siteId, name: 'Contatti' })
      .expect(201);
    expect(createRes.body.name).toBe('Contatti');
    expect(createRes.body.fields).toEqual([]);
    expect(createRes.body.steps).toEqual([]);
    const formId = createRes.body.id;

    const getRes = await agent.get(`/forms/${formId}`).expect(200);
    expect(getRes.body.id).toBe(formId);

    const updateRes = await agent
      .patch(`/forms/${formId}`)
      .send({
        name: 'Richiedi preventivo',
        fields: [
          { id: 'email', label: 'Email', type: 'email', required: true },
        ],
        notificationEmail: 'owner@example.com',
      })
      .expect(200);
    expect(updateRes.body.name).toBe('Richiedi preventivo');
    expect(updateRes.body.fields).toHaveLength(1);
    expect(updateRes.body.notificationEmail).toBe('owner@example.com');

    const listRes = await agent.get('/forms').query({ siteId }).expect(200);
    expect(listRes.body.total).toBeGreaterThanOrEqual(1);
    expect(listRes.body.items.map((f: { id: string }) => f.id)).toContain(
      formId,
    );

    await agent.delete(`/forms/${formId}`).expect(204);
    await agent.get(`/forms/${formId}`).expect(404);
  });

  it('404s reading a form that does not exist', async () => {
    await agent.get(`/forms/${randomUUID()}`).expect(404);
  });

  it('persists steps and per-field stepId assignments across the real HTTP+DB stack', async () => {
    const createRes = await agent
      .post('/forms')
      .send({ siteId, name: 'Candidatura' })
      .expect(201);
    const formId = createRes.body.id;

    const updateRes = await agent
      .patch(`/forms/${formId}`)
      .send({
        name: 'Candidatura',
        fields: [
          {
            id: 'nome',
            label: 'Nome',
            type: 'text',
            required: true,
            stepId: 'dati-personali',
          },
        ],
        steps: [{ id: 'dati-personali', title: 'Dati personali' }],
        notificationEmail: null,
      })
      .expect(200);

    expect(updateRes.body.steps).toEqual([
      { id: 'dati-personali', title: 'Dati personali' },
    ]);
    expect(updateRes.body.fields[0].stepId).toBe('dati-personali');

    const getRes = await agent.get(`/forms/${formId}`).expect(200);
    expect(getRes.body.steps).toEqual([
      { id: 'dati-personali', title: 'Dati personali' },
    ]);

    await agent.delete(`/forms/${formId}`).expect(204);
  });

  it('404s updating a form that does not exist', async () => {
    await agent
      .patch(`/forms/${randomUUID()}`)
      .send({ name: 'x', fields: [], notificationEmail: null })
      .expect(404);
  });

  it('404s deleting a form that does not exist', async () => {
    await agent.delete(`/forms/${randomUUID()}`).expect(404);
  });

  it('401s without a session cookie', async () => {
    await request(app.getHttpServer())
      .get('/forms')
      .query({ siteId })
      .expect(401);
  });
});
