import { and, asc, eq } from 'drizzle-orm';
import type { PageVersion } from '@brisk/domain-core';
import type { PageVersionRepositoryPort } from '@brisk/ports';
import { type BriskDb, pageVersions, withTenant } from '@brisk/postgres-db';
import { savePageVersionTx } from './save-page-version-tx.js';

function fromRow(row: typeof pageVersions.$inferSelect): PageVersion {
  return row;
}

/** Connects as `brisk_app` — see docs/adr/0002-non-superuser-role-for-rls-enforcement.md. */
export class DrizzlePageVersionRepository implements PageVersionRepositoryPort {
  constructor(private readonly db: BriskDb) {}

  async save(version: PageVersion): Promise<void> {
    await withTenant(this.db, version.tenantId, (tx) =>
      savePageVersionTx(tx, version),
    );
  }

  async findById(
    tenantId: string,
    versionId: string,
  ): Promise<PageVersion | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(pageVersions)
        .where(
          and(
            eq(pageVersions.tenantId, tenantId),
            eq(pageVersions.id, versionId),
          ),
        )
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  /** Oldest first, matching the order used by the in-memory fake in application tests. */
  async listByPage(tenantId: string, pageId: string): Promise<PageVersion[]> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(pageVersions)
        .where(
          and(
            eq(pageVersions.tenantId, tenantId),
            eq(pageVersions.pageId, pageId),
          ),
        )
        .orderBy(asc(pageVersions.createdAt)),
    );
    return rows.map(fromRow);
  }
}
