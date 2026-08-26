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
  users,
  withTenant,
} from '@brisk/postgres-db';
import { AUTH_PORT } from '../auth/auth.tokens.js';
import { AuthModule } from '../auth/auth.module.js';
import { DATABASE } from '../database.module.js';
import { UsersModule } from './users.module.js';

const MAILPIT_URL = `http://localhost:${process.env['MAILPIT_UI_PORT'] ?? '8025'}`;

/**
 * Runs the full invite -> accept-invite cycle through the real HTTP stack,
 * a real Postgres, and a real SMTP relay (Mailpit in dev, see
 * docs/development.md) — same "real infra, not mocks" reasoning as
 * public-forms.controller.integration.spec.ts. Reads the actual invite
 * link out of Mailpit's own HTTP API instead of reaching into
 * VerificationTokenPort directly: only the token's SHA-256 hash is ever
 * persisted (see VerificationTokenAdapter), so the raw token genuinely
 * only exists in the email that was sent — polling Mailpit is the only
 * way to test the real, user-facing path end to end.
 */
async function fetchInviteToken(toEmail: string): Promise<string> {
  const deadline = Date.now() + 5000;
  for (;;) {
    const searchRes = await fetch(
      `${MAILPIT_URL}/api/v1/messages?query=${encodeURIComponent(`to:${toEmail}`)}`,
    );
    const search = (await searchRes.json()) as {
      messages: { ID: string }[];
    };
    if (search.messages.length > 0) {
      const messageRes = await fetch(
        `${MAILPIT_URL}/api/v1/message/${search.messages[0].ID}`,
      );
      const message = (await messageRes.json()) as { Text: string };
      const match = message.Text.match(/inviteToken=([^&\s]+)/);
      if (match) {
        return match[1];
      }
    }
    if (Date.now() > deadline) {
      throw new Error(`No invite email found for ${toEmail} within 5s`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

describe('Invite -> accept-invite (integration)', () => {
  let app: INestApplication;
  let db: BriskDb;
  let adminAgent: ReturnType<typeof request.agent>;
  let tenantId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [UsersModule, AuthModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.use(requestIdMiddleware);
    await app.init();
    db = app.get<BriskDb>(DATABASE);

    tenantId = process.env.DEFAULT_TENANT_ID as string;
    const authPort = app.get<AuthPort>(AUTH_PORT);
    const email = `invite-flow-admin-${randomUUID()}@example.test`;
    const password = randomUUID();
    const passwordHash = await authPort.hashPassword(password);
    const [admin] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(users)
        .values({
          tenantId,
          email,
          passwordHash,
          role: 'admin',
          displayName: 'Invite Flow Admin',
        })
        .returning({ id: users.id }),
    );
    createdUserIds.push(admin.id);

    adminAgent = request.agent(app.getHttpServer());
    await adminAgent
      .post('/auth/login')
      .send({ email, password, captchaToken: 'test-token' })
      .expect(200);
  });

  afterAll(async () => {
    await deleteIntegrationFixtures(db, tenantId, { userIds: createdUserIds });
    await app.close();
    await db.$client.end();
  });

  it('invites a user, accepts the invite from the emailed link, and logs in with the new password', async () => {
    const inviteeEmail = `invitee-${randomUUID()}@example.test`;

    const inviteRes = await adminAgent
      .post('/users/invite')
      .send({
        email: inviteeEmail,
        displayName: 'Nuovo Utente',
        role: 'editor',
      })
      .expect(201);
    expect(inviteRes.body.isActive).toBe(false);
    createdUserIds.push(inviteRes.body.id);

    const inviteToken = await fetchInviteToken(inviteeEmail);
    const newPassword = 'a-brand-new-password';

    await request(app.getHttpServer())
      .post('/auth/accept-invite')
      .send({ token: inviteToken, password: newPassword })
      .expect(200);

    const listRes = await adminAgent
      .get('/users')
      .query({ pageSize: 100 })
      .expect(200);
    const accepted = listRes.body.items.find(
      (u: { email: string }) => u.email === inviteeEmail,
    );
    expect(accepted.isActive).toBe(true);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: inviteeEmail,
        password: newPassword,
        captchaToken: 'test-token',
      })
      .expect(200);
    expect(loginRes.body.userId).toBe(inviteRes.body.id);
  });

  it('400s accepting an invite twice — the token is single-use', async () => {
    const inviteeEmail = `invitee-${randomUUID()}@example.test`;
    const inviteRes = await adminAgent
      .post('/users/invite')
      .send({
        email: inviteeEmail,
        displayName: 'Utente Singolo Uso',
        role: 'editor',
      })
      .expect(201);
    createdUserIds.push(inviteRes.body.id);
    const inviteToken = await fetchInviteToken(inviteeEmail);

    await request(app.getHttpServer())
      .post('/auth/accept-invite')
      .send({ token: inviteToken, password: 'first-password' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/accept-invite')
      .send({ token: inviteToken, password: 'second-password' })
      .expect(400);
  });

  it('400s accepting an invite with a garbage token', async () => {
    await request(app.getHttpServer())
      .post('/auth/accept-invite')
      .send({ token: 'not-a-real-token', password: 'irrelevant-password' })
      .expect(400);
  });

  it('403s a non-admin inviting a user', async () => {
    const authPort = app.get<AuthPort>(AUTH_PORT);
    const editorEmail = `invite-flow-editor-${randomUUID()}@example.test`;
    const password = randomUUID();
    const passwordHash = await authPort.hashPassword(password);
    const [editor] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(users)
        .values({
          tenantId,
          email: editorEmail,
          passwordHash,
          role: 'editor',
          displayName: 'Invite Flow Editor',
        })
        .returning({ id: users.id }),
    );
    createdUserIds.push(editor.id);
    const editorAgent = request.agent(app.getHttpServer());
    await editorAgent
      .post('/auth/login')
      .send({ email: editorEmail, password, captchaToken: 'test-token' })
      .expect(200);

    await editorAgent
      .post('/users/invite')
      .send({
        email: `should-not-be-invited-${randomUUID()}@example.test`,
        displayName: 'Non dovrebbe esistere',
        role: 'editor',
      })
      .expect(403);
  });

  it('409s inviting an email that already belongs to a user', async () => {
    const inviteeEmail = `invitee-${randomUUID()}@example.test`;
    const inviteRes = await adminAgent
      .post('/users/invite')
      .send({ email: inviteeEmail, displayName: 'Prima Volta', role: 'editor' })
      .expect(201);
    createdUserIds.push(inviteRes.body.id);

    await adminAgent
      .post('/users/invite')
      .send({
        email: inviteeEmail,
        displayName: 'Seconda Volta',
        role: 'editor',
      })
      .expect(409);
  });
});
