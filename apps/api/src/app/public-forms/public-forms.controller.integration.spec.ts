import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { AuthPort, CaptchaPort, NewsletterPort } from '@brisk/ports';
import {
  type BriskDb,
  deleteIntegrationFixtures,
  sites,
  users,
  withTenant,
} from '@brisk/postgres-db';
import { AUTH_PORT } from '../auth/auth.tokens.js';
import { DATABASE } from '../database.module.js';
import { FormsModule } from '../forms/forms.module.js';
import { PublicFormsModule } from './public-forms.module.js';
import { CAPTCHA_PORT, NEWSLETTER_PORT } from './public-forms.tokens.js';

/** Unlike Postgres/Mailpit (real local infra this repo already runs for
 * every integration test), Cloudflare's siteverify API is a live
 * third-party endpoint — depending on it here would make this suite's
 * pass/fail depend on Cloudflare's uptime and network reachability from
 * CI, not on whether our own code is correct. Overridden below with this
 * in-process fake instead, mirroring FakeCaptchaPort's contract
 * (@brisk/application's unit-test fixture): any non-empty token passes. */
class FakeCaptchaPort implements CaptchaPort {
  async verify({ token }: { token: string }): Promise<boolean> {
    return token.trim() !== '';
  }
}

/** Same "no live third party in tests" reasoning as FakeCaptchaPort above — also lets tests assert exactly what got subscribed. */
class RecordingNewsletterPort implements NewsletterPort {
  readonly subscribedEmails: string[] = [];
  async subscribe(email: string): Promise<void> {
    this.subscribedEmails.push(email);
  }
}

/**
 * Runs against a real Postgres and a real SMTP relay (Mailpit in dev, see
 * docs/development.md). Combines FormsModule (to create a form the normal,
 * authenticated way) with PublicFormsModule under test, then reads/submits
 * it through the public endpoints with NO session — same reasoning as
 * public-pages.controller.integration.spec.ts.
 */
describe('PublicFormsController (integration)', () => {
  let app: INestApplication;
  let db: BriskDb;
  let agent: ReturnType<typeof request.agent>;
  let siteId: string;
  let tenantId: string;
  let userId: string;
  let newsletterPort: RecordingNewsletterPort;

  beforeAll(async () => {
    newsletterPort = new RecordingNewsletterPort();
    const moduleRef = await Test.createTestingModule({
      imports: [FormsModule, PublicFormsModule],
    })
      .overrideProvider(CAPTCHA_PORT)
      .useClass(FakeCaptchaPort)
      .overrideProvider(NEWSLETTER_PORT)
      .useValue(newsletterPort)
      .compile();

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
          name: `Public Forms Integration Site ${randomUUID()}`,
          defaultLocale: 'it',
        })
        .returning({ id: sites.id }),
    );
    siteId = site.id;

    const authPort = app.get<AuthPort>(AUTH_PORT);
    const email = `public-forms-integration-${randomUUID()}@example.test`;
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
});
