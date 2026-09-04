import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { type BriskDb, type BriskTx, withTenant } from './client';

export interface Pagination {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

/**
 * The shared base for the identical CRUD repeated in every tenant-scoped
 * Drizzle repository (media/form/user/page/site-layout-section): the same
 * save() (insert plus onConflictDoUpdate on the PK), the same findById(),
 * the same delete(), the same paginated "select + count" list, newest
 * first. Only the table/columns and how to map to and from the domain
 * differ — those stay abstract hooks in the subclass, and the rest lives
 * here once instead of five times.
 *
 * `table`/`idColumn`/`tenantIdColumn` are deliberately typed "widely"
 * (`PgTable`/`AnyPgColumn`, not each table's concrete types): TypeScript
 * has no way of statically correlating "this column belongs to this table"
 * across three independent generics (`TRow`/`TEntity` plus the table's
 * concrete type) without a fourth generic dedicated to each subclass — the
 * invariant (that the columns and the row really do belong to the same
 * table) is guaranteed by the subclass itself anyway, which declares all
 * three together.
 */
export abstract class DrizzlePaginatedRepository<
  TSelectRow extends { tenantId: string },
  TEntity,
  TWriteRow extends { tenantId: string } = TSelectRow,
> {
  protected constructor(protected readonly db: BriskDb) {}

  protected abstract readonly table: PgTable;
  protected abstract readonly idColumn: AnyPgColumn;
  protected abstract readonly tenantIdColumn: AnyPgColumn;

  /**
   * Two row generics rather than one: for most tables "what you read" and
   * "what you write" coincide (`TWriteRow` defaults to `TSelectRow`), but
   * `pages` is different — `toRow()` deliberately omits `searchText` (a
   * column belonging to `@brisk/postgres-search-repository`, never written
   * from here), which `$inferSelect` always includes. See
   * `DrizzlePageRepository`.
   */
  protected abstract toRow(entity: TEntity): TWriteRow;
  protected abstract fromRow(row: TSelectRow): TEntity;

  async save(entity: TEntity): Promise<void> {
    const row = this.toRow(entity);
    await withTenant(this.db, row.tenantId, (tx) => this.upsertTx(tx, row));
  }

  /**
   * Exposed protected rather than staying internal to `save()`:
   * `DrizzleUserRepository` and `DrizzlePageRepository` call it inside their
   * own try/catch to translate a unique violation on a constraint other
   * than the PK, without duplicating insert+onConflictDoUpdate.
   */
  protected upsertTx(tx: BriskTx, row: TWriteRow) {
    return tx
      .insert(this.table)
      .values(row as Record<string, unknown>)
      .onConflictDoUpdate({
        target: this.idColumn,
        set: row as Record<string, unknown>,
      });
  }

  async findById(tenantId: string, id: string): Promise<TEntity | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(this.table)
        .where(and(eq(this.tenantIdColumn, tenantId), eq(this.idColumn, id)))
        .limit(1),
    );
    return rows[0] ? this.fromRow(rows[0] as TSelectRow) : null;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await withTenant(this.db, tenantId, (tx) =>
      tx
        .delete(this.table)
        .where(and(eq(this.tenantIdColumn, tenantId), eq(this.idColumn, id))),
    );
  }

  /** The subclass builds its own scope (tenant-only, or tenant+site) and passes the ordering column — it shares only the count+select+pagination mechanism. */
  protected async listPaginatedTx(
    tenantId: string,
    scope: SQL | undefined,
    sortColumn: AnyPgColumn,
    pagination: Pagination,
  ): Promise<PaginatedResult<TEntity>> {
    const [rows, totalRows] = await withTenant(this.db, tenantId, (tx) =>
      Promise.all([
        tx
          .select()
          .from(this.table)
          .where(scope)
          .orderBy(desc(sortColumn))
          .limit(pagination.pageSize)
          .offset((pagination.page - 1) * pagination.pageSize),
        tx.select({ total: count() }).from(this.table).where(scope),
      ]),
    );
    return {
      items: (rows as TSelectRow[]).map((row) => this.fromRow(row)),
      total: totalRows[0].total,
    };
  }
}
