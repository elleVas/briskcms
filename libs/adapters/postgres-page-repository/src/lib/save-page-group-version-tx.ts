import { and, desc, eq, notInArray } from 'drizzle-orm';
import type { PageGroupVersion } from '@brisk/domain-core';
import { type BriskTx, pageGroupVersions } from '@brisk/postgres-db';

// The same hard-cap policy as savePageVersionTx — see its comment for why
// (no age-based exemption, pruning inline after every save).
const MAX_VERSIONS_TO_KEEP = 10;

/**
 * Inserts the SHARED structure's version and prunes those beyond
 * `MAX_VERSIONS_TO_KEEP`, inside the caller's `tx` transaction — the same
 * pattern as savePageVersionTx, a parallel versioning stream (this one for
 * PageGroup.content, the other — savePageTranslationVersionTx — for the
 * per-locale text).
 */
export async function savePageGroupVersionTx(
  tx: BriskTx,
  version: PageGroupVersion,
): Promise<void> {
  await tx.insert(pageGroupVersions).values(version);

  const recent = await tx
    .select({ id: pageGroupVersions.id })
    .from(pageGroupVersions)
    .where(
      and(
        eq(pageGroupVersions.tenantId, version.tenantId),
        eq(pageGroupVersions.pageGroupId, version.pageGroupId),
      ),
    )
    .orderBy(desc(pageGroupVersions.createdAt))
    .limit(MAX_VERSIONS_TO_KEEP);
  const keepIds = recent.map((row) => row.id);
  if (keepIds.length === 0) return;

  await tx
    .delete(pageGroupVersions)
    .where(
      and(
        eq(pageGroupVersions.tenantId, version.tenantId),
        eq(pageGroupVersions.pageGroupId, version.pageGroupId),
        notInArray(pageGroupVersions.id, keepIds),
      ),
    );
}
