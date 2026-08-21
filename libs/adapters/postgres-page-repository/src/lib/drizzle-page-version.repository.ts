import { and, asc, desc, eq, lt, notInArray } from 'drizzle-orm';
import type { PageVersion } from '@brisk/domain-core';
import type { PageVersionRepositoryPort } from '@brisk/ports';
import {
  type BriskDb,
  type BriskTx,
  pageVersions,
  withTenant,
} from '@brisk/postgres-db';

// A version survives if it's among the most recent MAX_VERSIONS_TO_KEEP OR
// newer than RETENTION_DAYS — only pruned when both conditions fail. No
// scheduled job: pruning runs inline after every save, in the same
// transaction, so the table never needs a separate cleanup process.
const MAX_VERSIONS_TO_KEEP = 20;
const RETENTION_DAYS = 90;

function fromRow(row: typeof pageVersions.$inferSelect): PageVersion {
  return row;
}

/** Connects as `brisk_app` — see docs/adr/0002-non-superuser-role-for-rls-enforcement.md. */
export class DrizzlePageVersionRepository implements PageVersionRepositoryPort {
  constructor(private readonly db: BriskDb) {}

  async save(version: PageVersion): Promise<void> {
    await withTenant(this.db, version.tenantId, async (tx) => {
      await tx.insert(pageVersions).values(version);
      await this.prune(tx, version.tenantId, version.pageId);
    });
  }

  private async prune(
    tx: BriskTx,
    tenantId: string,
    pageId: string,
  ): Promise<void> {
    const recent = await tx
      .select({ id: pageVersions.id })
      .from(pageVersions)
      .where(
        and(
          eq(pageVersions.tenantId, tenantId),
          eq(pageVersions.pageId, pageId),
        ),
      )
      .orderBy(desc(pageVersions.createdAt))
      .limit(MAX_VERSIONS_TO_KEEP);
    const keepIds = recent.map((row) => row.id);

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const conditions = [
      eq(pageVersions.tenantId, tenantId),
      eq(pageVersions.pageId, pageId),
      lt(pageVersions.createdAt, cutoff),
    ];
    if (keepIds.length > 0) {
      conditions.push(notInArray(pageVersions.id, keepIds));
    }

    await tx.delete(pageVersions).where(and(...conditions));
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
