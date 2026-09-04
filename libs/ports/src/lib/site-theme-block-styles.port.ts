import type { BlockStyleOverride } from '@brisk/shared-types';

/**
 * Replaces what used to be `sites.theme_tokens.blockStyles` (a JSONB map
 * spread across the site's row) — one row per (site, block type) instead of
 * an entry nested in a blob (docs/adr/0022's follow-up). A Port of its own
 * rather than a method on SiteRepositoryPort: the same reason as SearchPort
 * — it is a distinct capability and storage, with a query shape of its own,
 * not an attribute of the site the way the Tier 1 fields (colours, font,
 * scripts) are.
 */
export interface SiteThemeBlockStylesPort {
  /** Every active override for the site, keyed by block type — an empty map when none has ever been customized. */
  listBySite(
    tenantId: string,
    siteId: string,
  ): Promise<Record<string, BlockStyleOverride>>;

  /** Sostituisce per intero l'override di UN tipo di blocco — upsert atomico su quella sola riga (site_id, block_type). */
  upsert(
    tenantId: string,
    siteId: string,
    blockType: string,
    style: BlockStyleOverride,
  ): Promise<void>;
}
