import { SiteNotFoundError, type Site } from '@brisk/domain-core';
import type { SiteRepositoryPort } from '@brisk/ports';

export interface UpdateSiteSeoSettingsDeps {
  siteRepository: SiteRepositoryPort;
}

export interface UpdateSiteSeoSettingsInput {
  tenantId: string;
  siteId: string;
  searchEngineIndexingEnabled: boolean;
}

export async function updateSiteSeoSettings(
  deps: UpdateSiteSeoSettingsDeps,
  input: UpdateSiteSeoSettingsInput,
): Promise<Site> {
  const site = await deps.siteRepository.findById(input.tenantId, input.siteId);
  if (!site) {
    throw new SiteNotFoundError(input.siteId);
  }

  site.updateSeoSettings({
    searchEngineIndexingEnabled: input.searchEngineIndexingEnabled,
  });
  await deps.siteRepository.save(site);

  return site;
}
