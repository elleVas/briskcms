import { SiteNotFoundError, type Site } from '@brisk/domain-core';
import type { UntranslatedPageFallback } from '@brisk/shared-types';
import type { SiteRepositoryPort } from '@brisk/ports';

export interface UpdateSiteLocaleSettingsDeps {
  siteRepository: SiteRepositoryPort;
}

export interface UpdateSiteLocaleSettingsInput {
  tenantId: string;
  siteId: string;
  defaultLocale: string;
  enabledLocales: string[];
  untranslatedPageFallback: UntranslatedPageFallback;
}

export async function updateSiteLocaleSettings(
  deps: UpdateSiteLocaleSettingsDeps,
  input: UpdateSiteLocaleSettingsInput,
): Promise<Site> {
  const site = await deps.siteRepository.findById(input.tenantId, input.siteId);
  if (!site) {
    throw new SiteNotFoundError(input.siteId);
  }

  site.updateLocaleSettings({
    defaultLocale: input.defaultLocale,
    enabledLocales: input.enabledLocales,
    untranslatedPageFallback: input.untranslatedPageFallback,
  });
  await deps.siteRepository.save(site);

  return site;
}
