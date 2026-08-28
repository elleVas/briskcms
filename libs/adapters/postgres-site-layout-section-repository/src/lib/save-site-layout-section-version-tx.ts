import { and, desc, eq, notInArray } from 'drizzle-orm';
import type { SiteLayoutSectionVersion } from '@brisk/domain-core';
import { type BriskTx, siteLayoutSectionVersions } from '@brisk/postgres-db';

// Same policy as page_versions (see save-page-version-tx.ts in
// postgres-page-repository) — a hard cap of the last 10, pruned inline
// after every save, no scheduled job.
const MAX_VERSIONS_TO_KEEP = 10;

/**
 * Inserisce la versione e pota le più vecchie oltre `MAX_VERSIONS_TO_KEEP`,
 * dentro la transazione `tx` del chiamante.
 */
export async function saveSiteLayoutSectionVersionTx(
  tx: BriskTx,
  version: SiteLayoutSectionVersion,
): Promise<void> {
  await tx.insert(siteLayoutSectionVersions).values(version);

  const recent = await tx
    .select({ id: siteLayoutSectionVersions.id })
    .from(siteLayoutSectionVersions)
    .where(
      and(
        eq(siteLayoutSectionVersions.tenantId, version.tenantId),
        eq(
          siteLayoutSectionVersions.siteLayoutSectionId,
          version.siteLayoutSectionId,
        ),
      ),
    )
    .orderBy(desc(siteLayoutSectionVersions.createdAt))
    .limit(MAX_VERSIONS_TO_KEEP);
  const keepIds = recent.map((row) => row.id);
  // keepIds always has at least the version just inserted above — never
  // empty in practice, but notInArray([]) would match everything and
  // delete the whole section's history, so guard it explicitly anyway.
  if (keepIds.length === 0) return;

  await tx
    .delete(siteLayoutSectionVersions)
    .where(
      and(
        eq(siteLayoutSectionVersions.tenantId, version.tenantId),
        eq(
          siteLayoutSectionVersions.siteLayoutSectionId,
          version.siteLayoutSectionId,
        ),
        notInArray(siteLayoutSectionVersions.id, keepIds),
      ),
    );
}
