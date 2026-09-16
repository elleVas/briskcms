import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from './users.module';
import { IntegrationApp } from '../../test/integration-app.test-fixture';

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
  To: { Address: string }[];
}

/**
 * The messages sent to `toEmail`, newest first.
 *
 * Through Mailpit's SEARCH endpoint. This used `/api/v1/messages?query=`,
 * and that endpoint ignores `query`: it returned the whole mailbox, so the
 * "invite" read below was whichever email arrived last to anyone. The test
 * passed only while that happened to be its own — and failed, reading
 * another test's email, whenever a suite running alongside sent one after
 * it ("10 email(s) for invitee-…, none carrying an inviteToken").
 *
 * Filtered on the address as well, so a search that matches more loosely
 * than asked can never hand back someone else's message.
 */
async function messagesFor(toEmail: string): Promise<MailpitMessage[]> {
  const res = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${toEmail}"`)}`,
  );
  const body = (await res.json()) as { messages: MailpitMessage[] | null };
  return (body.messages ?? []).filter((message) =>
    message.To.some((recipient) => recipient.Address === toEmail),
  );
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
  let integration: IntegrationApp;
  let app: INestApplication;
  let adminAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    integration = await IntegrationApp.start({
      imports: [UsersModule, AuthModule],
    });
    app = integration.app;
    adminAgent = await integration.login(
      await integration.createUser({ displayName: 'Invite Flow Admin' }),
    );
  });

  afterAll(async () => {
    await integration.close();
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
    integration.trackUser(inviteRes.body.id);

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
    integration.trackUser(inviteRes.body.id);
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
    const editorAgent = await integration.login(
      await integration.createUser({
        role: 'editor',
        displayName: 'Invite Flow Editor',
      }),
    );

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
    integration.trackUser(inviteRes.body.id);
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
    integration.trackUser(inviteRes.body.id);
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
    integration.trackUser(inviteRes.body.id);

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
