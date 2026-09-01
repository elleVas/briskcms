import { and, desc, eq, notInArray } from 'drizzle-orm';
import type { PageTranslationVersion } from '@brisk/domain-core';
import { type BriskTx, pageTranslationVersions } from '@brisk/postgres-db';

const MAX_VERSIONS_TO_KEEP = 10;

/**
 * Inserisce la versione del testo per-locale (overlay + seoMeta) e pota le
 * più vecchie oltre `MAX_VERSIONS_TO_KEEP` — stesso pattern di
 * savePageGroupVersionTx/savePageVersionTx, riguarda solo una traduzione
 * COLLEGATA (una scollegata versiona il proprio `divergedContent` come
 * PageGroupVersion, vedi PageTranslationVersion's doc comment).
 */
export async function savePageTranslationVersionTx(
  tx: BriskTx,
  version: PageTranslationVersion,
): Promise<void> {
  await tx.insert(pageTranslationVersions).values(version);

  const recent = await tx
    .select({ id: pageTranslationVersions.id })
    .from(pageTranslationVersions)
    .where(
      and(
        eq(pageTranslationVersions.tenantId, version.tenantId),
        eq(
          pageTranslationVersions.pageTranslationId,
          version.pageTranslationId,
        ),
      ),
    )
    .orderBy(desc(pageTranslationVersions.createdAt))
    .limit(MAX_VERSIONS_TO_KEEP);
  const keepIds = recent.map((row) => row.id);
  if (keepIds.length === 0) return;

  await tx
    .delete(pageTranslationVersions)
    .where(
      and(
        eq(pageTranslationVersions.tenantId, version.tenantId),
        eq(
          pageTranslationVersions.pageTranslationId,
          version.pageTranslationId,
        ),
        notInArray(pageTranslationVersions.id, keepIds),
      ),
    );
}
