import type { Site } from '@brisk/domain-core';

/**
 * Ogni metodo richiede esplicitamente tenantId: nessuna query può
 * "dimenticare" lo scoping per tenant a livello di firma del Port,
 * anche se l'adapter concreto si affida anche a RLS come seconda barriera.
 */
export interface SiteRepositoryPort {
  findByDomain(tenantId: string, domain: string): Promise<Site | null>;
}
