import { and, asc, desc, eq, notInArray } from 'drizzle-orm';
import type { PageVersion } from '@brisk/domain-core';
import type { PageVersionRepositoryPort } from '@brisk/ports';
import {
  type BriskDb,
  type BriskTx,
  pageVersions,
  withTenant,
} from '@brisk/postgres-db';

// Hard cap, not an age-based exemption: a page saved 30 times in one
// editing session is pruned down to the last 10 immediately, same as a
// page nobody has touched in a year. Simpler and more predictable than an
// earlier "last 20 OR newer than 90 days" design (see git history) — that
// union let an actively-edited page grow unbounded within the 90-day
// window, which defeated the point. No scheduled job: pruning runs
// inline after every save, in the same transaction.
const MAX_VERSIONS_TO_KEEP = 10;

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
    // keepIds always has at least the version just inserted by save() —
    // never empty in practice, but notInArray([]) would match everything
    // and delete the whole page's history, so guard it explicitly anyway.
    if (keepIds.length === 0) return;

    await tx
      .delete(pageVersions)
      .where(
        and(
          eq(pageVersions.tenantId, tenantId),
          eq(pageVersions.pageId, pageId),
          notInArray(pageVersions.id, keepIds),
        ),
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
