import { SiteNotFoundError, type Site } from '@brisk/domain-core';
import type { BusinessAddress, OpeningHoursDay } from '@brisk/shared-types';
import type { SiteRepositoryPort } from '@brisk/ports';

export interface UpdateSiteBusinessInfoDeps {
  siteRepository: SiteRepositoryPort;
}

export interface UpdateSiteBusinessInfoInput {
  tenantId: string;
  siteId: string;
  businessAddress: BusinessAddress | null;
  businessPhone: string | null;
  businessEmail: string | null;
  businessType: string | null;
  openingHours: OpeningHoursDay[] | null;
}

export async function updateSiteBusinessInfo(
  deps: UpdateSiteBusinessInfoDeps,
  input: UpdateSiteBusinessInfoInput,
): Promise<Site> {
  const site = await deps.siteRepository.findById(input.tenantId, input.siteId);
  if (!site) {
    throw new SiteNotFoundError(input.siteId);
  }

  site.updateBusinessInfo({
    businessAddress: input.businessAddress,
    businessPhone: input.businessPhone,
    businessEmail: input.businessEmail,
    businessType: input.businessType,
    openingHours: input.openingHours,
  });
  await deps.siteRepository.save(site);

  return site;
}
