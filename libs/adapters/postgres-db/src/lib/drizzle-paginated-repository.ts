import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { type BriskDb, type BriskTx, withTenant } from './client.js';

export interface Pagination {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

/**
 * Base condivisa per il CRUD identico ripetuto in ogni repository Drizzle
 * scoped-per-tenant (media/form/user/page/site-layout-section): stesso
 * save() (insert + onConflictDoUpdate sulla PK), stesso findById(), stesso
 * delete(), stessa lista paginata "select + count" più recente prima.
 * Cambia solo la tabella/colonne e come si mappa da/verso il dominio —
 * quelli restano hook astratti nella sottoclasse, il resto vive qui una
 * volta sola invece che 5 volte.
 *
 * `table`/`idColumn`/`tenantIdColumn` sono tipati in modo volutamente
 * "largo" (`PgTable`/`AnyPgColumn`, non i tipi concreti di ogni tabella):
 * TypeScript non ha modo di correlare staticamente "questa colonna
 * appartiene a questa tabella" attraverso tre generici indipendenti
 * (`TRow`/`TEntity` più il tipo concreto della tabella) senza un quarto
 * generico dedicato per ogni sottoclasse — l'invariante (colonne e riga
 * appartengono davvero alla stessa tabella) è comunque garantita dalla
 * sottoclasse stessa, che li dichiara tutti e tre insieme.
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
   * Due generici di riga, non uno solo: per la maggior parte delle tabelle
   * "cosa si legge" e "cosa si scrive" coincidono (`TWriteRow` di default è
   * proprio `TSelectRow`), ma `pages` no — `toRow()` omette di proposito
   * `searchText` (colonna di `@brisk/postgres-search-repository`, mai
   * scritta da qui), che invece `$inferSelect` include sempre. Vedi
   * `DrizzlePageRepository`.
   */
  protected abstract toRow(entity: TEntity): TWriteRow;
  protected abstract fromRow(row: TSelectRow): TEntity;

  async save(entity: TEntity): Promise<void> {
    const row = this.toRow(entity);
    await withTenant(this.db, row.tenantId, (tx) => this.upsertTx(tx, row));
  }

  /**
   * Esposto protected, non solo interno a `save()`: `DrizzleUserRepository`
   * e `DrizzlePageRepository` lo richiamano dentro il proprio try/catch per
   * tradurre la unique-violation su un vincolo diverso dalla PK, senza
   * duplicare insert+onConflictDoUpdate.
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

  /** La sottoclasse costruisce il proprio scope (tenant-only, o tenant+site) e passa la colonna di ordinamento — condivide solo il meccanismo count+select+paginazione. */
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
