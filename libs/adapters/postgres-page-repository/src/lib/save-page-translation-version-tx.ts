import type { PageTranslationVersion } from '@brisk/domain-core';
import {
  type BriskTx,
  pageTranslationVersions,
  saveVersionTx,
} from '@brisk/postgres-db';

/**
 * Inserts the per-locale text's version (overlay plus seoMeta). It
 * concerns only a LINKED translation — an unlinked one versions its own
 * `divergedContent` as a PageGroupVersion, see PageTranslationVersion's
 * doc comment. Retention lives in `saveVersionTx`.
 */
export async function savePageTranslationVersionTx(
  tx: BriskTx,
  version: PageTranslationVersion,
): Promise<void> {
  await saveVersionTx(
    tx,
    pageTranslationVersions,
    {
      id: pageTranslationVersions.id,
      tenantId: pageTranslationVersions.tenantId,
      owner: pageTranslationVersions.pageTranslationId,
      createdAt: pageTranslationVersions.createdAt,
    },
    version,
    version.pageTranslationId,
  );
}
