import { and, desc, eq, notInArray } from 'drizzle-orm';
import type { PageGroupVersion } from '@brisk/domain-core';
import { type BriskTx, pageGroupVersions } from '@brisk/postgres-db';

// Stessa policy hard-cap di savePageVersionTx — vedi il suo commento per il
// perché (niente esenzione basata sull'età, pruning inline dopo ogni save).
const MAX_VERSIONS_TO_KEEP = 10;

/**
 * Inserisce la versione della struttura CONDIVISA e pota le più vecchie
 * oltre `MAX_VERSIONS_TO_KEEP`, dentro la transazione `tx` del chiamante —
 * stesso pattern di savePageVersionTx, stream di versioning parallelo
 * (questo per PageGroup.content, l'altro — savePageTranslationVersionTx —
 * per il testo per-locale).
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
