import { SiteNotFoundError } from '@brisk/domain-core';
import type {
  SiteRepositoryPort,
  SiteThemeBlockStylesPort,
} from '@brisk/ports';
import type { BlockStyleOverride } from '@brisk/shared-types';

export interface UpdateSiteThemeTokensDeps {
  siteRepository: SiteRepositoryPort;
  siteThemeBlockStylesRepository: SiteThemeBlockStylesPort;
}

export interface UpdateSiteThemeTokensInput {
  tenantId: string;
  siteId: string;
  blockType: string;
  style: BlockStyleOverride;
}

/**
 * Replaces the given block type's override wholesale (leaving the other
 * types untouched) through an atomic upsert on `site_theme_block_styles`
 * (docs/adr/0022's schema follow-up — no longer `sites.theme_tokens`). The
 * site's existence has to be checked separately: the child table has only
 * an FK on `site_id`, not a constraint yielding a readable domain error —
 * an explicit `findById` beats a generic FK-violation error propagated to
 * the caller.
 */
export async function updateSiteThemeTokens(
  deps: UpdateSiteThemeTokensDeps,
  input: UpdateSiteThemeTokensInput,
): Promise<void> {
  const site = await deps.siteRepository.findById(input.tenantId, input.siteId);
  if (!site) {
    throw new SiteNotFoundError(input.siteId);
  }

  await deps.siteThemeBlockStylesRepository.upsert(
    input.tenantId,
    input.siteId,
    input.blockType,
    input.style,
  );
}
