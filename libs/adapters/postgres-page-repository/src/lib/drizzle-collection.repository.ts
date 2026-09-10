import { and, asc, eq } from 'drizzle-orm';
import { Collection, type CollectionProps } from '@brisk/domain-core';
import type { CollectionRepositoryPort } from '@brisk/ports';
import { collections, withTenant, type BriskDb } from '@brisk/postgres-db';

function toRow(props: CollectionProps) {
  return {
    id: props.id,
    tenantId: props.tenantId,
    siteId: props.siteId,
    name: props.name,
    icon: props.icon,
    order: props.order,
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  };
}

function fromRow(row: typeof collections.$inferSelect): Collection {
  return Collection.fromProps({
    id: row.id,
    tenantId: row.tenantId,
    siteId: row.siteId,
    name: row.name,
    icon: row.icon,
    order: row.order,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * The editor's own sections.
 *
 * It lives in the page adapter rather than a package of its own: a
 * collection is one table with four methods, and what it describes is
 * how PAGES are organised — the same storage concern this package
 * already owns. A separate library for it would be scaffolding, not a
 * boundary.
 */
export class DrizzleCollectionRepository implements CollectionRepositoryPort {
  constructor(private readonly db: BriskDb) {}

  async save(collection: Collection): Promise<void> {
    const row = toRow(collection.toProps());
    await withTenant(this.db, row.tenantId, (tx) =>
      tx
        .insert(collections)
        .values(row)
        .onConflictDoUpdate({ target: collections.id, set: row }),
    );
  }

  async findById(tenantId: string, id: string): Promise<Collection | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(collections)
        .where(and(eq(collections.tenantId, tenantId), eq(collections.id, id)))
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  /** In the order they will appear in the sidebar, ties broken by age so the list never shuffles between two reads. */
  async listBySite(tenantId: string, siteId: string): Promise<Collection[]> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(collections)
        .where(
          and(
            eq(collections.tenantId, tenantId),
            eq(collections.siteId, siteId),
          ),
        )
        .orderBy(asc(collections.order), asc(collections.createdAt)),
    );
    return rows.map(fromRow);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await withTenant(this.db, tenantId, (tx) =>
      tx
        .delete(collections)
        .where(and(eq(collections.tenantId, tenantId), eq(collections.id, id))),
    );
  }
}
