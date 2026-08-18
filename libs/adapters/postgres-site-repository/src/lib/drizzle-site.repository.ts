import { and, eq } from 'drizzle-orm';
import { Site } from '@brisk/domain-core';
import type { SiteRepositoryPort } from '@brisk/ports';
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
}
