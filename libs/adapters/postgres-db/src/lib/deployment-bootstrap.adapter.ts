import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type {
  BootstrapDeploymentInput,
  BootstrapDeploymentResult,
  DeploymentBootstrapPort,
} from '@brisk/ports';
import type { BriskDb } from './client';
import { sites, tenants, users } from './schema';

/**
 * Replaces what `scripts/seed-default-tenant.ts` and
 * `scripts/seed-default-user.ts` do, for the first-run wizard: the same
 * three rows, but created together, from a browser, without shell access
 * to a container and without the admin password ever being written to a
 * `.env` file.
 *
 * The two scripts stay for development, where re-seeding a throwaway
 * database from a fixed `DEFAULT_TENANT_ID` is genuinely convenient. They
 * are no longer the documented path for a real deployment.
 *
 * One explicit transaction rather than `withTenant`: the tenant does not
 * exist yet when it opens, so there is nothing to scope to. It sets
 * `app.current_tenant_id` itself, after the tenant row and before the two
 * rows RLS actually guards — the same `set_config(..., true)` withTenant
 * uses, local to this transaction because connections are pooled.
 */
export class DrizzleDeploymentBootstrapAdapter implements DeploymentBootstrapPort {
  constructor(private readonly db: BriskDb) {}

  async hasBeenSetUp(): Promise<boolean> {
    // `tenants` is the root table and carries no RLS policy (see
    // schema.ts), which is what makes it readable at all before any tenant
    // context exists.
    const rows = await this.db
      .select({ id: tenants.id })
      .from(tenants)
      .limit(1);
    return rows.length > 0;
  }

  async bootstrap(
    input: BootstrapDeploymentInput,
  ): Promise<BootstrapDeploymentResult> {
    const tenantId = randomUUID();
    const siteId = randomUUID();
    const userId = randomUUID();

    await this.db.transaction(async (tx) => {
      await tx.insert(tenants).values({ id: tenantId, name: input.siteName });

      // From here on the transaction is scoped to the tenant just created,
      // so the RLS policies on `sites` and `users` let these two rows
      // through. Without it they would be inserted and then be invisible —
      // including to the login that follows immediately.
      await tx.execute(
        sql`select set_config('app.current_tenant_id', ${tenantId}, true)`,
      );

      await tx.insert(sites).values({
        id: siteId,
        tenantId,
        name: input.siteName,
        // Left null deliberately: the wizard runs before anyone can know
        // the public hostname (it may not even resolve yet), and
        // apps/public-site matches a site by the request's Host header.
        // The admin sets it in Site settings, which is also where the
        // consequence — "your site is not reachable yet" — is visible.
        domain: null,
        defaultLocale: input.defaultLocale,
        // Must contain defaultLocale (localeSettingsSchema): a site whose
        // default locale is not enabled resolves no pages at all.
        enabledLocales: [input.defaultLocale],
      });

      await tx.insert(users).values({
        id: userId,
        tenantId,
        email: input.adminEmail,
        passwordHash: input.adminPasswordHash,
        role: 'admin',
      });
    });

    return { tenantId, siteId, userId };
  }
}
