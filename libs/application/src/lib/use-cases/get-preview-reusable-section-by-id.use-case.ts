import type { PublishedPage } from '@brisk/shared-types';
import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
  PreviewTokenPort,
  ReusableSectionRepositoryPort,
  SiteLayoutSectionRepositoryPort,
  SiteRepositoryPort,
  SiteThemeBlockStylesPort,
} from '@brisk/ports';
import { resolvePageContentReferences } from './resolve-page-content-references';
import { resolveSiteChrome } from './resolve-site-chrome';

export interface GetPreviewReusableSectionByIdDeps {
  previewTokenPort: PreviewTokenPort;
  reusableSectionRepository: ReusableSectionRepositoryPort;
  pageGroupRepository: PageGroupRepositoryPort;
  pageTranslationRepository: PageTranslationRepositoryPort;
  siteRepository: SiteRepositoryPort;
  siteLayoutSectionRepository: SiteLayoutSectionRepositoryPort;
  siteThemeBlockStylesRepository: SiteThemeBlockStylesPort;
}

export interface GetPreviewReusableSectionByIdInput {
  tenantId: string;
  id: string;
  token: string;
  /** The language its links resolve in — a section has no locale of its own. */
  locale: string;
}

/**
 * The section's own DRAFT, shaped as a page so the section editor's canvas
 * can render it with the components every other canvas uses — the same
 * token-gated, otherwise unauthenticated posture as the page and
 * header/footer previews.
 *
 * The draft and not `publishedContent`: this is what the person editing it
 * is looking at, and a preview showing the published version would show
 * them everything except the change they just made.
 *
 * With no header and no footer. The section is not a page and does not sit
 * in a site's chrome; showing one around it would invite editing a header
 * from inside the section editor, which is a different screen's job. The
 * `site` half of the chrome IS resolved, because that is where the theme
 * and its tokens come from — without it the section would preview in the
 * wrong colours, which is precisely what a preview is for.
 */
export async function getPreviewReusableSectionById(
  deps: GetPreviewReusableSectionByIdDeps,
  input: GetPreviewReusableSectionByIdInput,
): Promise<PublishedPage | null> {
  const validToken = await deps.previewTokenPort.validateToken(
    input.token,
    'section',
    input.id,
  );
  if (!validToken || validToken.tenantId !== input.tenantId) {
    return null;
  }

  const section = await deps.reusableSectionRepository.findById(
    input.tenantId,
    input.id,
  );
  if (!section) {
    return null;
  }
  const site = await deps.siteRepository.findById(
    input.tenantId,
    section.siteId,
  );
  if (!site) {
    return null;
  }

  const [chrome, [content]] = await Promise.all([
    resolveSiteChrome(deps, input.tenantId, site, input.locale, {
      preview: true,
    }),
    resolvePageContentReferences(deps, input.tenantId, input.locale, [
      section.content,
    ]),
  ]);

  return {
    content,
    seoMeta: { title: section.name, description: '' },
    locale: input.locale,
    translations: [],
    ancestors: [],
    header: null,
    footer: null,
    headerSticky: false,
    site: chrome.site,
  };
}
