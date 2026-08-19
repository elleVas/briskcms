import type { SiteLayoutSectionVersion } from '@brisk/domain-core';

export interface SiteLayoutSectionVersionRepositoryPort {
  save(version: SiteLayoutSectionVersion): Promise<void>;
  findById(
    tenantId: string,
    versionId: string,
  ): Promise<SiteLayoutSectionVersion | null>;
  listBySection(
    tenantId: string,
    siteLayoutSectionId: string,
  ): Promise<SiteLayoutSectionVersion[]>;
}
