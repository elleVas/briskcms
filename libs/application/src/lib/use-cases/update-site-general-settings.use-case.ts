import { SiteNotFoundError, type Site } from '@brisk/domain-core';
import type { SiteRepositoryPort } from '@brisk/ports';

export interface UpdateSiteGeneralSettingsDeps {
  siteRepository: SiteRepositoryPort;
}

export interface UpdateSiteGeneralSettingsInput {
  tenantId: string;
  siteId: string;
  name: string;
  domain: string | null;
}

export async function updateSiteGeneralSettings(
  deps: UpdateSiteGeneralSettingsDeps,
  input: UpdateSiteGeneralSettingsInput,
): Promise<Site> {
  const site = await deps.siteRepository.findById(input.tenantId, input.siteId);
  if (!site) {
    throw new SiteNotFoundError(input.siteId);
  }

  site.updateGeneralSettings({ name: input.name, domain: input.domain });
  await deps.siteRepository.save(site);

  return site;
}
