import type { SiteLayoutSectionVersion } from '@brisk/domain-core';
import {
  type BriskTx,
  siteLayoutSectionVersions,
  saveVersionTx,
} from '@brisk/postgres-db';

/**
 * Inserts the header's or footer's version, inside the caller's `tx`.
 * Retention lives in `saveVersionTx`.
 */
export async function saveSiteLayoutSectionVersionTx(
  tx: BriskTx,
  version: SiteLayoutSectionVersion,
): Promise<void> {
  await saveVersionTx(
    tx,
    siteLayoutSectionVersions,
    {
      id: siteLayoutSectionVersions.id,
      tenantId: siteLayoutSectionVersions.tenantId,
      owner: siteLayoutSectionVersions.siteLayoutSectionId,
      createdAt: siteLayoutSectionVersions.createdAt,
    },
    version,
    version.siteLayoutSectionId,
  );
}
