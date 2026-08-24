import { SiteNotFoundError, type Site } from '@brisk/domain-core';
import type { SiteRepositoryPort } from '@brisk/ports';
import type { BlockStyleOverride } from '@brisk/shared-types';

export interface UpdateSiteThemeTokensDeps {
  siteRepository: SiteRepositoryPort;
}

export interface UpdateSiteThemeTokensInput {
  tenantId: string;
  siteId: string;
  blockType: string;
  style: BlockStyleOverride;
}

/** Vedi Site.updateThemeTokens — sostituisce per intero l'override del tipo di blocco dato, gli altri tipi restano invariati. */
export async function updateSiteThemeTokens(
  deps: UpdateSiteThemeTokensDeps,
  input: UpdateSiteThemeTokensInput,
): Promise<Site> {
  const site = await deps.siteRepository.findById(input.tenantId, input.siteId);
  if (!site) {
    throw new SiteNotFoundError(input.siteId);
  }

  site.updateThemeTokens(input.blockType, input.style);
  await deps.siteRepository.save(site);

  return site;
}
