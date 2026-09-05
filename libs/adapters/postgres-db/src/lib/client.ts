import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { requireEnv } from '@brisk/env-config';
import * as schema from './schema';

// Security review 2026-08-24, database section: postgres() ran with no
// options at all — the driver's own default (max: 10) was baked in,
// un-tunable without a code change. Irrelevant at today's scale, but a
// fixed number will eventually need adjusting for real multi-tenant load
// without a redeploy — an env var gets there without a schema change.
function poolMax(): number {
  const raw = process.env['POSTGRES_POOL_MAX'];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 10;
}

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: poolMax() });
  return drizzle(client, { schema });
}

export type BriskDb = ReturnType<typeof createDb>;
export type BriskTx = Parameters<Parameters<BriskDb['transaction']>[0]>[0];

/**
 * Admin/superuser connection string, for drizzle-kit migrations only — never
 * for runtime queries (bypasses RLS). See
 * docs/adr/0002-non-superuser-role-for-rls-enforcement.md.
 */
export function adminConnectionString(): string {
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = process.env.POSTGRES_PORT ?? '5432';
  const database = process.env.POSTGRES_DB ?? 'brisk';
  const user = process.env.POSTGRES_USER ?? 'brisk';
  const password = requireEnv('POSTGRES_PASSWORD');
  // client_min_messages=warning silences the ~40 NOTICEs the baseline
  // migration raises (identifier truncation, drop cascades). They are
  // normal, but postgres-js prints each as a red-looking JSON object, so
  // the one run a self-hoster is told to watch — `up migrate`, step 3 of
  // docs/self-hosting.md — read as a stack trace with "migrations applied
  // successfully" buried at the end. Set on the connection rather than
  // filtered after the fact: this way Postgres never sends them.
  const quiet = '?options=-c%20client_min_messages%3Dwarning';
  return `postgres://${user}:${password}@${host}:${port}/${database}${quiet}`;
}

/** brisk_app connection — what every runtime query must use, respects RLS. */
export function createAppDb(): BriskDb {
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = process.env.POSTGRES_PORT ?? '5432';
  const database = process.env.POSTGRES_DB ?? 'brisk';
  const password = requireEnv('POSTGRES_APP_PASSWORD');
  return createDb(
    `postgres://brisk_app:${password}@${host}:${port}/${database}`,
  );
}

/**
 * Every Postgres adapter must go through this: RLS only filters rows once
 * `app.current_tenant_id` is set for the session (see db/init/000_roles.sh and
 * drizzle/0000_baseline_schema.sql). Setting it inside a transaction with
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

/**
 * A trivial round-trip query, for health checks (docs/adr/0042) — kept
 * here rather than having a caller import `sql` from `drizzle-orm`
 * directly: every other raw-SQL-tag use in this codebase already lives
 * inside this package, not in apps/api.
 */
export async function pingDatabase(db: BriskDb): Promise<void> {
  await db.execute(sql`select 1`);
}
