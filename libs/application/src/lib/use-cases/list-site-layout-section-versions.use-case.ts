import type { SiteLayoutSectionVersion } from '@brisk/domain-core';
import type { SiteLayoutSectionVersionRepositoryPort } from '@brisk/ports';

export interface ListSiteLayoutSectionVersionsDeps {
  siteLayoutSectionVersionRepository: SiteLayoutSectionVersionRepositoryPort;
}

export interface ListSiteLayoutSectionVersionsInput {
  tenantId: string;
  id: string;
}

export function listSiteLayoutSectionVersions(
  deps: ListSiteLayoutSectionVersionsDeps,
  input: ListSiteLayoutSectionVersionsInput,
): Promise<SiteLayoutSectionVersion[]> {
  return deps.siteLayoutSectionVersionRepository.listBySection(
    input.tenantId,
    input.id,
  );
}
