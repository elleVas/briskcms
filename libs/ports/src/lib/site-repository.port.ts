import type { Site } from '@brisk/domain-core';
import type { BlockStyleOverride } from '@brisk/shared-types';

/**
 * Ogni metodo richiede esplicitamente tenantId: nessuna query può
 * "dimenticare" lo scoping per tenant a livello di firma del Port,
 * anche se l'adapter concreto si affida anche a RLS come seconda barriera.
 */
export interface SiteRepositoryPort {
  findByDomain(tenantId: string, domain: string): Promise<Site | null>;
  findById(tenantId: string, id: string): Promise<Site | null>;
  save(site: Site): Promise<void>;
  /**
   * Aggiorna SOLO l'override di stile per il tipo di blocco dato,
   * atomicamente (un `UPDATE ... jsonb_set` lato DB, non un findById +
   * mutate + save a riga intera) — a differenza di `save()`, due chiamate
   * concorrenti su tipi di blocco DIVERSI non possono perdersi a vicenda:
   * ognuna scrive solo la propria chiave dentro `themeTokens.blockStyles`,
   * mai l'intera riga. `null` se il sito non esiste.
   */
  updateThemeTokensBlockStyle(
    tenantId: string,
    siteId: string,
    blockType: string,
    style: BlockStyleOverride,
  ): Promise<Site | null>;
}
