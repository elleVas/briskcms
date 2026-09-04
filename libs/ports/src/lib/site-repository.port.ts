import type { Site } from '@brisk/domain-core';

/**
 * Every method requires tenantId explicitly: no query can "forget" its
 * per-tenant scoping at the Port's signature level, even though the
 * concrete adapter also relies on RLS as a second barrier.
 */
export interface SiteRepositoryPort {
  findByDomain(tenantId: string, domain: string): Promise<Site | null>;
  findById(tenantId: string, id: string): Promise<Site | null>;
  save(site: Site): Promise<void>;
}
