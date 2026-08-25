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
 * Sostituisce per intero l'override del tipo di blocco dato (gli altri
 * tipi restano invariati) via un upsert atomico su
 * `site_theme_block_styles` (docs/adr/0022's follow-up sullo schema — non
 * più `sites.theme_tokens`). L'esistenza del sito va verificata a parte:
 * la tabella figlia ha solo un FK su `site_id`, non un vincolo che dia un
 * errore di dominio leggibile — meglio un `findById` esplicito che un
 * generico errore di violazione FK propagato al chiamante.
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
