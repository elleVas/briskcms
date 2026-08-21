import type { SiteLayoutSectionKind } from '@brisk/domain-core';
import type { PageContent } from '@brisk/shared-types';
import type {
  PreviewTokenPort,
  SiteLayoutSectionRepositoryPort,
} from '@brisk/ports';

export interface GetPreviewSiteLayoutSectionByIdDeps {
  siteLayoutSectionRepository: SiteLayoutSectionRepositoryPort;
  previewTokenPort: PreviewTokenPort;
}

export interface GetPreviewSiteLayoutSectionByIdInput {
  tenantId: string;
  sectionId: string;
  token: string;
}

export interface PreviewSiteLayoutSection {
  content: PageContent;
  kind: SiteLayoutSectionKind;
  sticky: boolean;
  locale: string;
}

/**
 * L'editing draft, unauthenticated read path per header/footer (vedi il
 * piano dell'editor visuale, Giorno 1) — mostra sempre `content` (la
 * bozza), a prescindere da `status`. `kind` ('header'/'footer') è
 * `contentType` per PreviewTokenPort: si legge la riga per primo per
 * saperlo, poi si valida il token contro (kind, sectionId) — un token
 * emesso per l'header non convalida mai una richiesta sul footer, anche
 * con lo stesso id (non può succedere per costruzione: id diversi per
 * riga), ma soprattutto rifiuta un token con contentType sbagliato per
 * questo stesso id. Stessa postura "indistinguibile dal non-esistente" di
 * getPreviewPageById per qualunque fallimento.
 */
export async function getPreviewSiteLayoutSectionById(
  deps: GetPreviewSiteLayoutSectionByIdDeps,
  input: GetPreviewSiteLayoutSectionByIdInput,
): Promise<PreviewSiteLayoutSection | null> {
  const section = await deps.siteLayoutSectionRepository.findById(
    input.tenantId,
    input.sectionId,
  );
  if (!section) {
    return null;
  }

  const validToken = await deps.previewTokenPort.validateToken(
    input.token,
    section.kind,
    input.sectionId,
  );
  if (!validToken || validToken.tenantId !== input.tenantId) {
    return null;
  }

  return {
    content: section.content,
    kind: section.kind,
    sticky: section.sticky,
    locale: section.locale,
  };
}
