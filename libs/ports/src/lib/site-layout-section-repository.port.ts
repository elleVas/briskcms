import type {
  SiteLayoutSection,
  SiteLayoutSectionKind,
} from '@brisk/domain-core';

/**
 * Every method requires tenantId explicitly, the same principle as
 * PageRepositoryPort. No `delete`/`list`: there is no UX today for "delete
 * the header" — that gets added if and when it is genuinely needed (YAGNI).
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
