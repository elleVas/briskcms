import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FormsModule } from './forms.module';
import { IntegrationApp } from '../../test/integration-app.test-fixture';

/**
 * Runs against a real Postgres — see docs/development.md. Same
 * throwaway-site-under-DEFAULT_TENANT_ID isolation as
 * pages.controller.integration.spec.ts.
 */
describe('FormsController (integration)', () => {
  let integration: IntegrationApp;
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;
  let siteId: string;

  beforeAll(async () => {
    integration = await IntegrationApp.start({ imports: [FormsModule] });
    app = integration.app;
    siteId = await integration.createSite();
    agent = await integration.login(await integration.createUser());
  });

  afterAll(async () => {
    await integration.close();
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
        notificationEmails: ['owner@example.com'],
      })
      .expect(200);
    expect(updateRes.body.name).toBe('Richiedi preventivo');
    expect(updateRes.body.fields).toHaveLength(1);
    expect(updateRes.body.notificationEmails).toEqual(['owner@example.com']);

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
        notificationEmails: [],
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
      .send({ name: 'x', fields: [], notificationEmails: [] })
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
