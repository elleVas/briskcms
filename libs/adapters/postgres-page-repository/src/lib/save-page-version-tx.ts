import { and, desc, eq, notInArray } from 'drizzle-orm';
import type { PageVersion } from '@brisk/domain-core';
import { type BriskTx, pageVersions } from '@brisk/postgres-db';

// Hard cap, not an age-based exemption: a page saved 30 times in one
// editing session is pruned down to the last 10 immediately, same as a
// page nobody has touched in a year. Simpler and more predictable than an
// earlier "last 20 OR newer than 90 days" design (see git history) — that
// union let an actively-edited page grow unbounded within the 90-day
// window, which defeated the point. No scheduled job: pruning runs
// inline after every save, in the same transaction.
const MAX_VERSIONS_TO_KEEP = 10;

/**
 * Inserisce la versione e pota le più vecchie oltre `MAX_VERSIONS_TO_KEEP`,
 * dentro la transazione `tx` del chiamante — mai una propria `withTenant`:
 * usata sia da `DrizzlePageVersionRepository.save()` (la propria
 * transazione) sia da `DrizzlePageRepository.saveWithVersion()` (la stessa
 * transazione dell'upsert della pagina, vedi il commento sul Port).
 */
export async function savePageVersionTx(
  tx: BriskTx,
  version: PageVersion,
): Promise<void> {
  await tx.insert(pageVersions).values(version);

  const recent = await tx
    .select({ id: pageVersions.id })
    .from(pageVersions)
    .where(
      and(
        eq(pageVersions.tenantId, version.tenantId),
        eq(pageVersions.pageId, version.pageId),
      ),
    )
    .orderBy(desc(pageVersions.createdAt))
    .limit(MAX_VERSIONS_TO_KEEP);
  const keepIds = recent.map((row) => row.id);
  // keepIds always has at least the version just inserted above — never
  // empty in practice, but notInArray([]) would match everything and
  // delete the whole page's history, so guard it explicitly anyway.
  if (keepIds.length === 0) return;

  await tx
    .delete(pageVersions)
    .where(
      and(
        eq(pageVersions.tenantId, version.tenantId),
        eq(pageVersions.pageId, version.pageId),
        notInArray(pageVersions.id, keepIds),
      ),
    );
}
