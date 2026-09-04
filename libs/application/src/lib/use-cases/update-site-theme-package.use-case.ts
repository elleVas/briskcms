import {
  InvalidThemeNameError,
  SiteNotFoundError,
  type Site,
} from '@brisk/domain-core';
import type { SiteRepositoryPort, ThemeCatalogPort } from '@brisk/ports';

export interface UpdateSiteThemePackageDeps {
  siteRepository: SiteRepositoryPort;
  themeCatalog: ThemeCatalogPort;
}

export interface UpdateSiteThemePackageInput {
  tenantId: string;
  siteId: string;
  themeName: string;
}

/**
 * Tier 2 selection (docs/adr/0021/0042) — which bundled filesystem theme
 * this site renders, not the Tier 1 style overrides `updateSiteThemeSettings`
 * writes. `themeName` is validated against this deployment's real bundled
 * theme catalog (ThemeCatalogPort) here, not left to the controller — the
 * same use-case is the one place this rule needs to be enforced regardless
 * of caller.
 */
export async function updateSiteThemePackage(
  deps: UpdateSiteThemePackageDeps,
  input: UpdateSiteThemePackageInput,
): Promise<Site> {
  const site = await deps.siteRepository.findById(input.tenantId, input.siteId);
  if (!site) {
    throw new SiteNotFoundError(input.siteId);
  }

  const availableThemes = await deps.themeCatalog.listAvailableThemes();
  if (!availableThemes.some((theme) => theme.name === input.themeName)) {
    throw new InvalidThemeNameError(input.themeName);
  }

  site.updateThemePackage({ themeName: input.themeName });
  await deps.siteRepository.save(site);

  return site;
}
