import type {
  SiteLayoutSection,
  SiteLayoutSectionKind,
} from '@brisk/domain-core';

/**
 * Ogni metodo richiede esplicitamente tenantId, stesso principio di
 * PageRepositoryPort. Niente `delete`/`list`: non c'è oggi una UX per
 * "elimina l'header" — si aggiunge se/quando serve davvero (YAGNI).
 */
export interface SiteLayoutSectionRepositoryPort {
  save(section: SiteLayoutSection): Promise<void>;
  findById(tenantId: string, id: string): Promise<SiteLayoutSection | null>;
  findBySiteLocaleKind(
    tenantId: string,
    siteId: string,
    locale: string,
    kind: SiteLayoutSectionKind,
  ): Promise<SiteLayoutSection | null>;
}
