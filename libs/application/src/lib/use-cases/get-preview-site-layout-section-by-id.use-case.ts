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
 * The draft-editing, unauthenticated read path for the header and footer
 * (see the visual editor plan, Day 1) — it always shows `content` (the
 * draft), regardless of `status`. `kind` ('header'/'footer') is
 * `contentType` for PreviewTokenPort: the row is read first to learn it,
 * and the token is then validated against (kind, sectionId) — a token
 * issued for the header never validates a request for the footer, even with
 * the same id (which cannot happen by construction: different ids per row),
 * but above all it rejects a token with the wrong contentType for this same
 * id. The same "indistinguishable from non-existent" posture as
 * getPreviewPageById for any failure.
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
