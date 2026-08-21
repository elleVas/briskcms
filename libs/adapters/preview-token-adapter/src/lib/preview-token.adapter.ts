import { and, eq } from 'drizzle-orm';
import { generateOpaqueToken, hashOpaqueToken } from '@brisk/opaque-token';
import type { PreviewContentType } from '@brisk/domain-core';
import type { PreviewToken, PreviewTokenPort } from '@brisk/ports';
import {
  contentPreviewTokens,
  type BriskDb,
  withTenant,
} from '@brisk/postgres-db';

function toPreviewToken(
  row: typeof contentPreviewTokens.$inferSelect,
  token: string,
): PreviewToken {
  return {
    token,
    tenantId: row.tenantId,
    contentType: row.contentType,
    contentId: row.contentId,
    expiresAt: row.expiresAt,
  };
}

/**
 * Same opaque-token mechanic as SessionAuthAdapter/VerificationTokenAdapter
 * (@brisk/opaque-token) — connects as `brisk_app`, see
 * docs/adr/0002-non-superuser-role-for-rls-enforcement.md. Non-consumante a
 * differenza di VerificationTokenAdapter: `validateToken` non cancella la
 * riga, una sessione di preview ricarica l'iframe più volte (vedi il piano
 * dell'editor visuale, Giorno 1).
 *
 * `bootstrapTenantId`: stesso chicken-and-egg RLS di SessionAuthAdapter —
 * `validateToken` cerca un token per il suo hash (globalmente unico) prima
 * di sapere a quale tenant appartiene, ma RLS richiede
 * `app.current_tenant_id` impostato per vedere qualunque riga, anche una
 * già identificata da una chiave univoca. Sicuro nell'attuale modello
 * single-tenant-per-deployment (docs/adr/0010) — ogni riga di questa
 * tabella appartiene comunque già a questo unico tenant.
 */
export class PreviewTokenAdapter implements PreviewTokenPort {
  constructor(
    private readonly db: BriskDb,
    private readonly bootstrapTenantId: string,
  ) {}

  async createToken(
    tenantId: string,
    contentType: PreviewContentType,
    contentId: string,
    ttlMs: number,
  ): Promise<PreviewToken> {
    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + ttlMs);

    await withTenant(this.db, tenantId, (tx) =>
      tx.insert(contentPreviewTokens).values({
        tenantId,
        contentType,
        contentId,
        tokenHash: hashOpaqueToken(token),
        expiresAt,
      }),
    );

    return { token, tenantId, contentType, contentId, expiresAt };
  }

  async validateToken(
    token: string,
    contentType: PreviewContentType,
    contentId: string,
  ): Promise<PreviewToken | null> {
    const tokenHash = hashOpaqueToken(token);

    const rows = await withTenant(this.db, this.bootstrapTenantId, (tx) =>
      tx
        .select()
        .from(contentPreviewTokens)
        .where(
          and(
            eq(contentPreviewTokens.tokenHash, tokenHash),
            eq(contentPreviewTokens.contentType, contentType),
            eq(contentPreviewTokens.contentId, contentId),
          ),
        )
        .limit(1),
    );
    const row = rows[0];
    if (!row) {
      return null;
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return toPreviewToken(row, token);
  }
}
