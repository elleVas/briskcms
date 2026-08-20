import { SiteNotFoundError, type Site } from '@brisk/domain-core';
import type { SiteRepositoryPort } from '@brisk/ports';
import type { ThemeSettings } from '@brisk/shared-types';

export interface UpdateSiteThemeSettingsDeps {
  siteRepository: SiteRepositoryPort;
}

export interface UpdateSiteThemeSettingsInput extends ThemeSettings {
  tenantId: string;
  siteId: string;
}

export async function updateSiteThemeSettings(
  deps: UpdateSiteThemeSettingsDeps,
  input: UpdateSiteThemeSettingsInput,
): Promise<Site> {
  const site = await deps.siteRepository.findById(input.tenantId, input.siteId);
  if (!site) {
    throw new SiteNotFoundError(input.siteId);
  }

  site.updateThemeSettings({
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    fontFamily: input.fontFamily,
    customCss: input.customCss,
    headScript: input.headScript,
    bodyScript: input.bodyScript,
    faviconUrl: input.faviconUrl,
  });
  await deps.siteRepository.save(site);

  return site;
}
