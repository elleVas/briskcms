/**
 * Creates the single tenant + site this self-hosted instance serves — see
 * docs/adr/0010-session-based-auth-foundations.md for why DEFAULT_TENANT_ID
 * survives auth (Phase 3) as the bootstrap constant login uses before a
 * session exists, in this single-tenant-per-deployment MVP model.
 * Idempotent: safe to run on every deploy/dev startup.
 */
import { requireEnv } from '@brisk/env-config';
import { createAppDb, withTenant } from '../src/lib/client.js';
import { sites, tenants } from '../src/lib/schema.js';

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
