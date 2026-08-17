/**
 * TEMPORARY — creates the single fixed tenant + site that every request runs
 * as until Phase 3 (auth) exists (see apps/api's StaticTenantContextAdapter).
 * Idempotent: safe to run on every deploy/dev startup.
 */
import { createAppDb, withTenant } from '../src/lib/client.js';
import { sites, tenants } from '../src/lib/schema.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const tenantId = requireEnv('DEFAULT_TENANT_ID');
  const siteId = requireEnv('DEFAULT_SITE_ID');
  const db = createAppDb();

  await db
    .insert(tenants)
    .values({ id: tenantId, name: 'Default tenant' })
    .onConflictDoNothing();

  await withTenant(db, tenantId, (tx) =>
    tx
      .insert(sites)
      .values({
        id: siteId,
        tenantId,
        name: 'Default site',
        defaultLocale: 'it',
      })
      .onConflictDoNothing(),
  );

  console.log(`Seeded tenant ${tenantId} / site ${siteId}`);
  await db.$client.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
