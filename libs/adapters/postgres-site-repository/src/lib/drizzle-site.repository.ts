import { and, eq, sql } from 'drizzle-orm';
import { Site } from '@brisk/domain-core';
import type { SiteRepositoryPort } from '@brisk/ports';
import type { BlockStyleOverride } from '@brisk/shared-types';
import { type BriskDb, sites, withTenant } from '@brisk/postgres-db';

function fromRow(row: typeof sites.$inferSelect): Site {
  return Site.fromProps(row);
}

export class DrizzleSiteRepository implements SiteRepositoryPort {
  constructor(private readonly db: BriskDb) {}

  async findByDomain(tenantId: string, domain: string): Promise<Site | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(sites)
        .where(and(eq(sites.tenantId, tenantId), eq(sites.domain, domain)))
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async findById(tenantId: string, id: string): Promise<Site | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(sites)
        .where(and(eq(sites.tenantId, tenantId), eq(sites.id, id)))
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async save(site: Site): Promise<void> {
    const row = site.toProps();
    await withTenant(this.db, row.tenantId, (tx) =>
      tx
        .insert(sites)
        .values(row)
        .onConflictDoUpdate({ target: sites.id, set: row }),
    );
  }

  async updateThemeTokensBlockStyle(
    tenantId: string,
    siteId: string,
    blockType: string,
    style: BlockStyleOverride,
  ): Promise<Site | null> {
    // jsonb_set atomico invece di findById + mutate + save (che sovrascrive
    // l'intera riga con uno snapshot letto a inizio richiesta — vedi il
    // commento su save()): due chiamate concorrenti su tipi di blocco
    // DIVERSI ora non possono più perdersi a vicenda, perché ognuna
    // aggiorna solo la propria chiave dentro blockStyles, con la lettura
    // e la scrittura nella stessa istruzione SQL (nessuna finestra di
    // race tra le due, a differenza del round-trip applicativo di save()).
    // `create_missing=true` crea/sostituisce solo l'ULTIMA chiave del
    // path, non quelle intermedie — per questo `coalesce` garantisce che
    // `blockStyles` esista già come oggetto anche quando theme_tokens è
    // NULL (un sito che non ha mai personalizzato nulla).
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .update(sites)
        .set({
          themeTokens: sql`jsonb_set(
            coalesce(${sites.themeTokens}, '{"blockStyles":{}}'::jsonb),
            array['blockStyles', ${blockType}],
            ${JSON.stringify(style)}::jsonb,
            true
          )`,
        })
        .where(and(eq(sites.tenantId, tenantId), eq(sites.id, siteId)))
        .returning(),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }
}
