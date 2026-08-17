import { Injectable } from '@nestjs/common';
import type { TenantContextPort } from '@brisk/ports';

/**
 * TEMPORARY — until Phase 3 (auth) exists, every request runs as the same
 * fixed tenant, read from DEFAULT_TENANT_ID (see the seed script in
 * libs/adapters/postgres-db/scripts). Replace with a real adapter that
 * derives the tenant from the authenticated session once auth lands — do not
 * let this quietly become permanent.
 */
@Injectable()
export class StaticTenantContextAdapter implements TenantContextPort {
  getCurrentTenantId(): string {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      throw new Error(
        'Missing DEFAULT_TENANT_ID — run the default-tenant seed script and set it in .env (see docs/development.md).',
      );
    }
    return tenantId;
  }
}
