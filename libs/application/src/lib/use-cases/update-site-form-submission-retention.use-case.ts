import { SiteNotFoundError, type Site } from '@brisk/domain-core';
import type { SiteRepositoryPort } from '@brisk/ports';

export interface UpdateSiteFormSubmissionRetentionDeps {
  siteRepository: SiteRepositoryPort;
}

export interface UpdateSiteFormSubmissionRetentionInput {
  tenantId: string;
  siteId: string;
  formSubmissionRetentionDays: number | null;
}

export async function updateSiteFormSubmissionRetention(
  deps: UpdateSiteFormSubmissionRetentionDeps,
  input: UpdateSiteFormSubmissionRetentionInput,
): Promise<Site> {
  const site = await deps.siteRepository.findById(input.tenantId, input.siteId);
  if (!site) {
    throw new SiteNotFoundError(input.siteId);
  }

  site.updateFormSubmissionRetention({
    formSubmissionRetentionDays: input.formSubmissionRetentionDays,
  });
  await deps.siteRepository.save(site);

  return site;
}
