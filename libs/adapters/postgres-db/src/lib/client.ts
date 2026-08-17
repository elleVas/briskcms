import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export function createDb(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

export type BriskDb = ReturnType<typeof createDb>;
export type BriskTx = Parameters<Parameters<BriskDb['transaction']>[0]>[0];

/**
 * Every Postgres adapter must go through this: RLS only filters rows once
 * `app.current_tenant_id` is set for the session (see db/init/000_roles.sh and
 * drizzle/0001_rls_and_grants.sql). Setting it inside a transaction with
 * `is_local = true` scopes it to that transaction only — required because
 * connections are pooled and reused across requests for different tenants.
 */
export async function withTenant<T>(
  db: BriskDb,
  tenantId: string,
  fn: (tx: BriskTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_tenant_id', ${tenantId}, true)`,
    );
    return fn(tx);
  });
}
