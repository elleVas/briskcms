import { and, eq } from 'drizzle-orm';
import type { SiteThemeBlockStylesPort } from '@brisk/ports';
import type { BlockStyleOverride } from '@brisk/shared-types';
import {
  type BriskDb,
  siteThemeBlockStyles,
  withTenant,
} from '@brisk/postgres-db';

/**
 * Sostituisce l'`UPDATE ... jsonb_set` su `sites.theme_tokens`
 * (docs/adr/0022's follow-up sullo schema): una riga per (site, block
 * type) invece di una voce annidata in un blob unico. L'upsert resta
 * atomico allo stesso modo — anzi più semplice, un `INSERT ... ON
 * CONFLICT DO UPDATE` diretto, niente più path JSONB da costruire —
 * riduce solo il "quanto viene toccato" ad ogni scrittura (questa riga
 * stretta invece dell'intera riga larga `sites`) e abilita query dirette
 * per tipo di blocco.
 */
export class DrizzleSiteThemeBlockStylesRepository implements SiteThemeBlockStylesPort {
  constructor(private readonly db: BriskDb) {}

  async listBySite(
    tenantId: string,
    siteId: string,
  ): Promise<Record<string, BlockStyleOverride>> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(siteThemeBlockStyles)
        .where(
          and(
            eq(siteThemeBlockStyles.tenantId, tenantId),
            eq(siteThemeBlockStyles.siteId, siteId),
          ),
        ),
    );
    return Object.fromEntries(rows.map((row) => [row.blockType, row.style]));
  }

  async upsert(
    tenantId: string,
    siteId: string,
    blockType: string,
    style: BlockStyleOverride,
  ): Promise<void> {
    await withTenant(this.db, tenantId, (tx) =>
      tx
        .insert(siteThemeBlockStyles)
        .values({ tenantId, siteId, blockType, style })
        .onConflictDoUpdate({
          target: [siteThemeBlockStyles.siteId, siteThemeBlockStyles.blockType],
          set: { style },
        }),
    );
  }
}
