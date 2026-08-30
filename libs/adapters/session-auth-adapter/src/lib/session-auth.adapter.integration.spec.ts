import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type BriskDb,
  createAppDb,
  deleteIntegrationTenants,
  sessions,
  tenants,
  users,
  withTenant,
} from '@brisk/postgres-db';
import { SessionAuthAdapter } from './session-auth.adapter';

/**
 * Runs against a real Postgres — see docs/development.md. Connects as
 * `brisk_app`, same as production code, so this also regression-tests RLS
 * isolation for `sessions` (see 0003_sessions_rls.sql).
 */
describe('SessionAuthAdapter (integration)', () => {
  let db: BriskDb;
  let adapter: SessionAuthAdapter;
  let tenantId: string;

  beforeAll(async () => {
    db = createAppDb();

    const [tenant] = await db
      .insert(tenants)
      .values({ name: `Integration Tenant ${randomUUID()}` })
      .returning({ id: tenants.id });
    tenantId = tenant.id;
    adapter = new SessionAuthAdapter(db, tenantId);
  });

  afterAll(async () => {
    await deleteIntegrationTenants(db, [tenantId]);
    await db.$client.end();
  });

  // Fresh user per test: sessions for one test's user must never leak into
  // another test's row-count assertions.
  async function createTestUser(): Promise<string> {
    const [user] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(users)
        .values({
          tenantId,
          email: `user-${randomUUID()}@example.com`,
          passwordHash: 'irrelevant-for-this-suite',
          role: 'admin',
        })
        .returning({ id: users.id }),
    );
    return user.id;
  }

  it('creates a session that validates back to the same user/tenant', async () => {
    const userId = await createTestUser();
    const created = await adapter.createSession(userId, tenantId);

    const validated = await adapter.validateSession(created.token);

    expect(validated?.userId).toBe(userId);
    expect(validated?.tenantId).toBe(tenantId);
  });

  it('never persists the plaintext token — only its hash is in the DB', async () => {
    const userId = await createTestUser();
    const created = await adapter.createSession(userId, tenantId);

    const [row] = await withTenant(db, tenantId, (tx) =>
      tx.select().from(sessions).where(eq(sessions.userId, userId)).limit(1),
    );

    expect(row.tokenHash).not.toBe(created.token);
  });

  it('rejects an unknown token', async () => {
    expect(await adapter.validateSession('not-a-real-token')).toBeNull();
  });

  it('invalidateSession makes the token stop validating', async () => {
    const userId = await createTestUser();
    const created = await adapter.createSession(userId, tenantId);

    await adapter.invalidateSession(created.token);

    expect(await adapter.validateSession(created.token)).toBeNull();
  });

  it('treats an expired session as invalid and deletes it', async () => {
    const userId = await createTestUser();
    const created = await adapter.createSession(userId, tenantId);
    await withTenant(db, tenantId, (tx) =>
      tx
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(sessions.userId, userId)),
    );

    expect(await adapter.validateSession(created.token)).toBeNull();

    const remaining = await withTenant(db, tenantId, (tx) =>
      tx.select().from(sessions).where(eq(sessions.userId, userId)),
    );
    expect(remaining).toHaveLength(0);
  });

  it('invalidateAllSessionsForUser removes every session for that user, but not others', async () => {
    const userId = await createTestUser();
    const otherUserId = await createTestUser();
    const created1 = await adapter.createSession(userId, tenantId);
    const created2 = await adapter.createSession(userId, tenantId);
    const otherCreated = await adapter.createSession(otherUserId, tenantId);

    await adapter.invalidateAllSessionsForUser(userId, tenantId);

    expect(await adapter.validateSession(created1.token)).toBeNull();
    expect(await adapter.validateSession(created2.token)).toBeNull();
    expect(await adapter.validateSession(otherCreated.token)).not.toBeNull();
  });

  it('renews a session that is past the halfway point of its lifetime', async () => {
    const userId = await createTestUser();
    const created = await adapter.createSession(userId, tenantId);
    const almostExpired = new Date(Date.now() + 1000 * 60); // 1 minute left
    await withTenant(db, tenantId, (tx) =>
      tx
        .update(sessions)
        .set({ expiresAt: almostExpired })
        .where(eq(sessions.userId, userId)),
    );

    const validated = await adapter.validateSession(created.token);

    expect(validated?.expiresAt.getTime()).toBeGreaterThan(
      almostExpired.getTime(),
    );
  });
});
