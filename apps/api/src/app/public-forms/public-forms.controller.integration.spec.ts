import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FakeCaptchaPort, FakeNewsletterPort } from '@brisk/testing';
import { FormsModule } from '../forms/forms.module';
import { PublicFormsModule } from './public-forms.module';
import { CAPTCHA_PORT, NEWSLETTER_PORT } from './public-forms.tokens';
import { IntegrationApp } from '../../test/integration-app.test-fixture';

/**
 * Runs against a real Postgres and a real SMTP relay (Mailpit in dev, see
 * docs/development.md). Combines FormsModule (to create a form the normal,
 * authenticated way) with PublicFormsModule under test, then reads/submits
 * it through the public endpoints with NO session — same reasoning as
 * public-pages.controller.integration.spec.ts.
 */
describe('PublicFormsController (integration)', () => {
  let integration: IntegrationApp;
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;
  let siteId: string;
  let newsletterPort: FakeNewsletterPort;

  beforeAll(async () => {
    newsletterPort = new FakeNewsletterPort();
    integration = await IntegrationApp.start({
      imports: [FormsModule, PublicFormsModule],
      // Cloudflare's siteverify and the newsletter provider are live third
      // parties, unlike Postgres and Mailpit: depending on them would make
      // this suite depend on their uptime. The fake newsletter port also
      // records what got subscribed, for the assertions below.
      overrideProviders: (builder) =>
        builder
          .overrideProvider(CAPTCHA_PORT)
          .useClass(FakeCaptchaPort)
          .overrideProvider(NEWSLETTER_PORT)
          .useValue(newsletterPort),
    });
    app = integration.app;
    siteId = await integration.createSite();
    agent = await integration.login(await integration.createUser());
  });

  afterAll(async () => {
    await integration.close();
  });

  async function createForm(
    fields: unknown[],
    notificationEmail: string | null,
  ) {
    const createRes = await agent
      .post('/forms')
      .send({ siteId, name: 'Contatti' })
      .expect(201);
    const updateRes = await agent
      .patch(`/forms/${createRes.body.id}`)
      .send({ name: 'Contatti', fields, notificationEmail })
      .expect(200);
    return updateRes.body.id as string;
  }

  it('serves a form definition without the notification email, without a session', async () => {
    const formId = await createForm(
      [{ id: 'email', label: 'Email', type: 'email', required: true }],
      'owner@example.com',
    );

    const res = await request(app.getHttpServer())
      .get(`/public/forms/${formId}`)
      .expect(200);

    expect(res.body).toEqual({
      id: formId,
      name: 'Contatti',
      fields: [{ id: 'email', label: 'Email', type: 'email', required: true }],
      steps: [],
    });
    expect(res.body).not.toHaveProperty('notificationEmail');
  });

  it('404s reading a form that does not exist', async () => {
    await request(app.getHttpServer())
      .get(`/public/forms/${randomUUID()}`)
      .expect(404);
  });

  it('accepts a valid submission without a session', async () => {
    const formId = await createForm(
      [{ id: 'email', label: 'Email', type: 'email', required: true }],
      'owner@example.com',
    );

    await request(app.getHttpServer())
      .post(`/public/forms/${formId}/submissions`)
      .send({
        values: { email: 'visitor@example.com' },
        honeypot: '',
        captchaToken: 'test-token',
      })
      .expect(204);
  });

  it('400s a submission missing a required field', async () => {
    const formId = await createForm(
      [{ id: 'email', label: 'Email', type: 'email', required: true }],
      'owner@example.com',
    );

    await request(app.getHttpServer())
      .post(`/public/forms/${formId}/submissions`)
      .send({ values: {}, honeypot: '', captchaToken: 'test-token' })
      .expect(400);
  });

  it('400s a submission with a missing or invalid CAPTCHA token', async () => {
    const formId = await createForm(
      [{ id: 'email', label: 'Email', type: 'email', required: true }],
      'owner@example.com',
    );

    await request(app.getHttpServer())
      .post(`/public/forms/${formId}/submissions`)
      .send({ values: { email: 'visitor@example.com' }, honeypot: '' })
      .expect(400);
  });

  it('silently accepts a honeypot-filled submission (204, not a distinguishing rejection)', async () => {
    const formId = await createForm(
      [{ id: 'email', label: 'Email', type: 'email', required: true }],
      'owner@example.com',
    );

    await request(app.getHttpServer())
      .post(`/public/forms/${formId}/submissions`)
      .send({ values: {}, honeypot: 'i-am-a-bot' })
      .expect(204);
  });

  it('subscribes the submitted email when the newsletter-consent field is checked', async () => {
    const formId = await createForm(
      [
        { id: 'email', label: 'Email', type: 'email', required: true },
        {
          id: 'newsletter',
          label: 'Iscrivimi alla newsletter',
          type: 'newsletter-consent',
          required: false,
        },
      ],
      null,
    );

    await request(app.getHttpServer())
      .post(`/public/forms/${formId}/submissions`)
      .send({
        values: { email: 'newsletter-fan@example.com', newsletter: true },
        honeypot: '',
        captchaToken: 'test-token',
      })
      .expect(204);

    expect(newsletterPort.subscribedEmails).toContain(
      'newsletter-fan@example.com',
    );
  });

  it('404s submitting to a form that does not exist', async () => {
    await request(app.getHttpServer())
      .post(`/public/forms/${randomUUID()}/submissions`)
      .send({ values: {}, honeypot: '', captchaToken: 'test-token' })
      .expect(404);
  });

  it('uploads an attachment and returns its public URL and original filename', async () => {
    const formId = await createForm(
      [{ id: 'cv', label: 'Curriculum', type: 'file', required: false }],
      null,
    );

    const res = await request(app.getHttpServer())
      .post(`/public/forms/${formId}/attachments`)
      .attach('file', Buffer.from('%PDF-1.4 fake pdf'), 'cv.pdf')
      .expect(201);

    expect(res.body.filename).toBe('cv.pdf');
    expect(res.body.url).toContain('/uploads/attachments/');
  });

  it('400s an attachment upload with no file', async () => {
    const formId = await createForm(
      [{ id: 'cv', label: 'Curriculum', type: 'file', required: false }],
      null,
    );

    await request(app.getHttpServer())
      .post(`/public/forms/${formId}/attachments`)
      .expect(400);
  });

  it('404s an attachment upload for a form that does not exist', async () => {
    await request(app.getHttpServer())
      .post(`/public/forms/${randomUUID()}/attachments`)
      .attach('file', Buffer.from('data'), 'file.txt')
      .expect(404);
  });
});
