import type { BlockStyleOverride } from '@brisk/shared-types';

/**
 * Sostituisce quello che prima era `sites.theme_tokens.blockStyles` (una
 * mappa JSONB sparsa sulla riga del sito) — una riga per (sito, tipo di
 * blocco) invece di una voce annidata in un blob (docs/adr/0022's
 * follow-up). Il suo proprio Port, non un metodo su SiteRepositoryPort:
 * stessa ragione di SearchPort — è una capacità/storage distinta, con
 * forma di query propria, non un attributo del sito come i campi di Tier
 * 1 (colori, font, script).
 */
export interface SiteThemeBlockStylesPort {
  /** Tutti gli override attivi per il sito, per tipo di blocco — mappa vuota se nessuno è mai stato personalizzato. */
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
