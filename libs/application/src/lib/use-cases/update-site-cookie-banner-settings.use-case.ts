import { SiteNotFoundError, type Site } from '@brisk/domain-core';
import type { SiteRepositoryPort } from '@brisk/ports';
import type { CookieBannerSettings } from '@brisk/shared-types';

export interface UpdateSiteCookieBannerSettingsDeps {
  siteRepository: SiteRepositoryPort;
}

export interface UpdateSiteCookieBannerSettingsInput extends CookieBannerSettings {
  tenantId: string;
  siteId: string;
}

export async function updateSiteCookieBannerSettings(
  deps: UpdateSiteCookieBannerSettingsDeps,
  input: UpdateSiteCookieBannerSettingsInput,
): Promise<Site> {
  const site = await deps.siteRepository.findById(input.tenantId, input.siteId);
  if (!site) {
    throw new SiteNotFoundError(input.siteId);
  }

  site.updateCookieBannerSettings({
    enabled: input.enabled,
    position: input.position,
    acceptButtonSide: input.acceptButtonSide,
    showReopenTab: input.showReopenTab,
    reopenPosition: input.reopenPosition,
    privacyPolicyPageGroupId: input.privacyPolicyPageGroupId,
    cookiePolicyPageGroupId: input.cookiePolicyPageGroupId,
    copyOverrides: input.copyOverrides,
  });
  await deps.siteRepository.save(site);

  return site;
}
