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

/**
 * Sostituisce per intero l'override del tipo di blocco dato, gli altri tipi
 * restano invariati — via un UPDATE atomico lato DB
 * (`updateThemeTokensBlockStyle`), non un findById + mutate + save a riga
 * intera: due chiamate concorrenti su tipi di blocco diversi (es. due
 * editor che salvano lo stile di blocchi diversi nello stesso momento) non
 * possono più sovrascriversi a vicenda.
 */
export async function updateSiteThemeTokens(
  deps: UpdateSiteThemeTokensDeps,
  input: UpdateSiteThemeTokensInput,
): Promise<Site> {
  const site = await deps.siteRepository.updateThemeTokensBlockStyle(
    input.tenantId,
    input.siteId,
    input.blockType,
    input.style,
  );
  if (!site) {
    throw new SiteNotFoundError(input.siteId);
  }

  return site;
}
