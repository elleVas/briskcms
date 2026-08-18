import { SiteNotFoundError, type Site } from '@brisk/domain-core';
import type { OpeningHoursDay } from '@brisk/shared-types';
import type { SiteRepositoryPort } from '@brisk/ports';

export interface UpdateSiteBusinessInfoDeps {
  siteRepository: SiteRepositoryPort;
}

export interface UpdateSiteBusinessInfoInput {
  tenantId: string;
  siteId: string;
  businessAddress: string | null;
  businessPhone: string | null;
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
    businessType: input.businessType,
    openingHours: input.openingHours,
  });
  await deps.siteRepository.save(site);

  return site;
}
