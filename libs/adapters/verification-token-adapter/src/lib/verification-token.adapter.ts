import { and, eq } from 'drizzle-orm';
import { generateOpaqueToken, hashOpaqueToken } from '@brisk/opaque-token';
import type { VerificationTokenPurpose } from '@brisk/domain-core';
import type { VerificationToken, VerificationTokenPort } from '@brisk/ports';
import {
  type BriskDb,
  verificationTokens,
  withTenant,
} from '@brisk/postgres-db';

function toVerificationToken(
  row: typeof verificationTokens.$inferSelect,
  token: string,
): VerificationToken {
  return {
    token,
    userId: row.userId,
    tenantId: row.tenantId,
    purpose: row.purpose,
    expiresAt: row.expiresAt,
  };
}

/**
 * Same opaque-token mechanic as SessionAuthAdapter (@brisk/opaque-token),
 * but for one-time tokens — connects as `brisk_app`, see
 * docs/adr/0002-non-superuser-role-for-rls-enforcement.md.
 *
 * `bootstrapTenantId`: same RLS chicken-and-egg as SessionAuthAdapter —
 * `consumeToken` looks a token up by its globally-unique hash before the
 * tenant is known. See docs/adr/0010-session-based-auth-foundations.md.
 */
export class VerificationTokenAdapter implements VerificationTokenPort {
  constructor(
    private readonly db: BriskDb,
    private readonly bootstrapTenantId: string,
  ) {}

  async createToken(
    userId: string,
    tenantId: string,
    purpose: VerificationTokenPurpose,
    ttlMs: number,
  ): Promise<VerificationToken> {
    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + ttlMs);

    await withTenant(this.db, tenantId, (tx) =>
      tx.insert(verificationTokens).values({
        tenantId,
        userId,
        purpose,
        tokenHash: hashOpaqueToken(token),
        expiresAt,
      }),
    );

    return { token, userId, tenantId, purpose, expiresAt };
  }

  async consumeToken(
    token: string,
    purpose: VerificationTokenPurpose,
  ): Promise<VerificationToken | null> {
    const tokenHash = hashOpaqueToken(token);

    // DELETE ... RETURNING is atomic: a concurrent second consume of the
    // same token finds nothing to delete, so double-consumption can't
    // race — no explicit row locking needed.
    const rows = await withTenant(this.db, this.bootstrapTenantId, (tx) =>
      tx
        .delete(verificationTokens)
        .where(
          and(
            eq(verificationTokens.tokenHash, tokenHash),
            eq(verificationTokens.purpose, purpose),
          ),
        )
        .returning(),
    );
    const row = rows[0];
    if (!row) {
      return null;
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return toVerificationToken(row, token);
  }
}
