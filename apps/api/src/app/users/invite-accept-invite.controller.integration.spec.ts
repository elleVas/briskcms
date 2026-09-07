import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HttpExceptionFilter } from '../http-exception.filter';
import { requestIdMiddleware } from '../request-id.middleware';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { AuthPort } from '@brisk/ports';
import {
  type BriskDb,
  deleteIntegrationFixtures,
  users,
  withTenant,
} from '@brisk/postgres-db';
import { AUTH_PORT } from '../auth/auth.tokens';
import { AuthModule } from '../auth/auth.module';
import { DATABASE } from '../database.module';
import { UsersModule } from './users.module';

const MAILPIT_URL = `http://localhost:${process.env['MAILPIT_UI_PORT'] ?? '8025'}`;

// 'resends the invite' below chains THREE of the polling loops below back
// to back, so this file's Jest timeout has to clear their combined worst
// case with room to spare — 3 x EMAIL_DELIVERY_TIMEOUT_MS, plus the real
// HTTP/Postgres/SMTP work around them. Keep the two numbers in step: a
// per-poll budget that outgrows this one turns an honest "no email
// arrived" into a bare Jest timeout, which says nothing about why.
jest.setTimeout(60_000);

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
/**
 * How long to wait for an email that has to travel over SMTP to a real
 * Mailpit before the test gives up.
 *
 * Deliberately generous, because it is NOT a performance assertion: there
 * is no deterministic signal to wait on here, only polling, and the
 * deadline exists so a genuine failure ends instead of hanging forever.
 * Five seconds was not generous, and this suite runs `--parallel=1` with
 * coverage on a shared runner — so it timed out on load that had nothing
 * to do with email, and the fix was always "run it again". A test that
 * cries wolf is worse than no test: it teaches everyone to re-run a red
 * build, which is how a real failure eventually goes unnoticed.
 *
 * Bounded by this file's `jest.setTimeout` above, not independent of it:
 * one test chains three of these waits, so the two numbers have to be
 * chosen together.
 */
const EMAIL_DELIVERY_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 200;

interface MailpitMessage {
  ID: string;
}

async function messagesFor(toEmail: string): Promise<MailpitMessage[]> {
  const res = await fetch(
    `${MAILPIT_URL}/api/v1/messages?query=${encodeURIComponent(`to:${toEmail}`)}`,
  );
  const body = (await res.json()) as { messages: MailpitMessage[] };
  return body.messages;
}

/**
 * One polling loop for both waits below, so the timeout is one number
 * rather than two that can drift.
 *
 * `read` returns `null` for "not yet"; `describeFailure` gets the mailbox
 * as it finally stood, so the error can say whether nothing arrived at all
 * or something arrived without what was expected in it — the difference
 * between "slow" and "broken", which the old message could not tell.
 */
async function pollMailbox<T>(
  toEmail: string,
  read: (messages: MailpitMessage[]) => Promise<T | null>,
  describeFailure: (messages: MailpitMessage[]) => string,
): Promise<T> {
  const deadline = Date.now() + EMAIL_DELIVERY_TIMEOUT_MS;
  for (;;) {
    const messages = await messagesFor(toEmail);
    const found = await read(messages);
    if (found !== null) {
      return found;
    }
    if (Date.now() > deadline) {
      throw new Error(
        `${describeFailure(messages)} after ${EMAIL_DELIVERY_TIMEOUT_MS / 1000}s`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function fetchInviteToken(toEmail: string): Promise<string> {
  return pollMailbox(
    toEmail,
    async (messages) => {
      if (messages.length === 0) {
        return null;
      }
      const messageRes = await fetch(
        `${MAILPIT_URL}/api/v1/message/${messages[0].ID}`,
      );
      const message = (await messageRes.json()) as { Text: string };
      return message.Text.match(/inviteToken=([^&\s]+)/)?.[1] ?? null;
    },
    (messages) =>
      messages.length === 0
        ? `No email at all for ${toEmail}`
        : `${messages.length} email(s) for ${toEmail}, none carrying an inviteToken`,
  );
}

/** Waits until at least `count` messages exist for `toEmail` — used to confirm a resend actually sent a second email, without assuming Mailpit's ordering. */
async function waitForMessageCount(
  toEmail: string,
  count: number,
): Promise<void> {
  await pollMailbox(
    toEmail,
    (messages) => Promise.resolve(messages.length >= count ? true : null),
    (messages) =>
      `Expected ${count} email(s) for ${toEmail}, found ${messages.length}`,
  );
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

  it('re-sends the invite with a fresh, still-working token', async () => {
    const inviteeEmail = `invitee-${randomUUID()}@example.test`;
    const inviteRes = await adminAgent
      .post('/users/invite')
      .send({
        email: inviteeEmail,
        displayName: 'Da Re-invitare',
        role: 'editor',
      })
      .expect(201);
    createdUserIds.push(inviteRes.body.id);
    await fetchInviteToken(inviteeEmail);

    await adminAgent
      .post(`/users/${inviteRes.body.id}/resend-invite`)
      .expect(200);
    await waitForMessageCount(inviteeEmail, 2);

    const freshToken = await fetchInviteToken(inviteeEmail);
    await request(app.getHttpServer())
      .post('/auth/accept-invite')
      .send({ token: freshToken, password: 'fresh-password' })
      .expect(200);
  });

  it('409s resending an invite to a user who already accepted it', async () => {
    const inviteeEmail = `invitee-${randomUUID()}@example.test`;
    const inviteRes = await adminAgent
      .post('/users/invite')
      .send({
        email: inviteeEmail,
        displayName: 'Attivo Subito',
        role: 'editor',
      })
      .expect(201);
    createdUserIds.push(inviteRes.body.id);
    const inviteToken = await fetchInviteToken(inviteeEmail);
    await request(app.getHttpServer())
      .post('/auth/accept-invite')
      .send({ token: inviteToken, password: 'a-password' })
      .expect(200);

    await adminAgent
      .post(`/users/${inviteRes.body.id}/resend-invite`)
      .expect(409);
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
