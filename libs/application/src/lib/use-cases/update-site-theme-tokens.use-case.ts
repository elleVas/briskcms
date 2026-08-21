import { SiteNotFoundError, type Site } from '@brisk/domain-core';
import type { SiteRepositoryPort } from '@brisk/ports';
import type { ThemeTokens } from '@brisk/shared-types';

export interface UpdateSiteThemeTokensDeps {
  siteRepository: SiteRepositoryPort;
}

export interface UpdateSiteThemeTokensInput {
  tenantId: string;
  siteId: string;
  tokens: Partial<ThemeTokens>;
}

/** Vedi Site.updateThemeTokens — per-categoria: solo le categorie presenti in `tokens` vengono sostituite. */
export async function updateSiteThemeTokens(
  deps: UpdateSiteThemeTokensDeps,
  input: UpdateSiteThemeTokensInput,
): Promise<Site> {
  const site = await deps.siteRepository.findById(input.tenantId, input.siteId);
  if (!site) {
    throw new SiteNotFoundError(input.siteId);
  }

  site.updateThemeTokens(input.tokens);
  await deps.siteRepository.save(site);

  return site;
}
