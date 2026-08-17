import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type BriskDb,
  createAppDb,
  tenants,
  users,
  verificationTokens,
  withTenant,
} from '@brisk/postgres-db';
import { VerificationTokenAdapter } from './verification-token.adapter.js';

/**
 * Runs against a real Postgres — see docs/development.md. Connects as
 * `brisk_app`, so this also regression-tests RLS isolation for
 * `verification_tokens` (see 0005_verification_tokens_rls.sql).
 */
describe('VerificationTokenAdapter (integration)', () => {
  let db: BriskDb;
  let adapter: VerificationTokenAdapter;
  let tenantId: string;

  beforeAll(async () => {
    db = createAppDb();

    const [tenant] = await db
      .insert(tenants)
      .values({ name: `Integration Tenant ${randomUUID()}` })
      .returning({ id: tenants.id });
    tenantId = tenant.id;
    adapter = new VerificationTokenAdapter(db, tenantId);
  });

  afterAll(async () => {
    await db.$client.end();
  });

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

  it('creates a token that consumes back to the same user/tenant/purpose', async () => {
    const userId = await createTestUser();
    const created = await adapter.createToken(
      userId,
      tenantId,
      'email-verification',
      1000 * 60 * 60,
    );

    const consumed = await adapter.consumeToken(
      created.token,
      'email-verification',
    );

    expect(consumed?.userId).toBe(userId);
    expect(consumed?.tenantId).toBe(tenantId);
    expect(consumed?.purpose).toBe('email-verification');
  });

  it('never persists the plaintext token — only its hash is in the DB', async () => {
    const userId = await createTestUser();
    const created = await adapter.createToken(
      userId,
      tenantId,
      'password-reset',
      1000 * 60,
    );

    const [row] = await withTenant(db, tenantId, (tx) =>
      tx
        .select()
        .from(verificationTokens)
        .where(eq(verificationTokens.userId, userId))
        .limit(1),
    );

    expect(row.tokenHash).not.toBe(created.token);
  });

  it('is single-use: a second consume of the same token fails', async () => {
    const userId = await createTestUser();
    const created = await adapter.createToken(
      userId,
      tenantId,
      'password-reset',
      1000 * 60,
    );

    const first = await adapter.consumeToken(created.token, 'password-reset');
    const second = await adapter.consumeToken(created.token, 'password-reset');

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('rejects a token consumed with the wrong purpose', async () => {
    const userId = await createTestUser();
    const created = await adapter.createToken(
      userId,
      tenantId,
      'password-reset',
      1000 * 60,
    );

    expect(
      await adapter.consumeToken(created.token, 'email-verification'),
    ).toBeNull();
  });

  it('rejects an unknown token', async () => {
    expect(
      await adapter.consumeToken('not-a-real-token', 'password-reset'),
    ).toBeNull();
  });

  it('rejects an expired token', async () => {
    const userId = await createTestUser();
    const created = await adapter.createToken(
      userId,
      tenantId,
      'password-reset',
      1000 * 60,
    );
    await withTenant(db, tenantId, (tx) =>
      tx
        .update(verificationTokens)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(verificationTokens.userId, userId)),
    );

    expect(
      await adapter.consumeToken(created.token, 'password-reset'),
    ).toBeNull();
  });
});
