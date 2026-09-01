import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
  PreviewTokenPort,
  SiteLayoutSectionRepositoryPort,
  SiteRepositoryPort,
  SiteThemeBlockStylesPort,
} from '@brisk/ports';
import { mergeTranslatedContent, type PageContent } from '@brisk/shared-types';
import { resolveSiteChrome } from './resolve-site-chrome';
import { resolvePageGroupAncestors } from './resolve-page-group-ancestors';
import { resolvePageContentReferences } from './resolve-page-content-references';
import type { PublishedPage } from './get-published-page-by-slug.use-case';

export interface GetPreviewPageByIdDeps {
  pageGroupRepository: PageGroupRepositoryPort;
  pageTranslationRepository: PageTranslationRepositoryPort;
  siteRepository: SiteRepositoryPort;
  siteLayoutSectionRepository: SiteLayoutSectionRepositoryPort;
  siteThemeBlockStylesRepository: SiteThemeBlockStylesPort;
  previewTokenPort: PreviewTokenPort;
}

export interface GetPreviewPageByIdInput {
  tenantId: string;
  /** A PageTranslation id — was a Page id under the old model (see the plan). */
  pageId: string;
  token: string;
}

/**
 * i18n a livello di campo (see the plan) — replaces the old Page-based
 * implementation, same unauthenticated-but-token-gated posture as before
 * (see the original's own doc comment). Shows the CURRENT draft, not the
 * frozen publishedSnapshot: for a linked translation that's the live
 * merge of PageGroup.content + this locale's fieldValues (so a structural
 * edit shows up in preview immediately, matching what saving the group
 * would look like once this translation republishes), for a diverged one
 * it's `divergedContent` directly.
 */
export async function getPreviewPageById(
  deps: GetPreviewPageByIdDeps,
  input: GetPreviewPageByIdInput,
): Promise<PublishedPage | null> {
  const validToken = await deps.previewTokenPort.validateToken(
    input.token,
    'page',
    input.pageId,
  );
  if (!validToken || validToken.tenantId !== input.tenantId) {
    return null;
  }

  const translation = await deps.pageTranslationRepository.findById(
    input.tenantId,
    input.pageId,
  );
  if (!translation) {
    return null;
  }

  const group = await deps.pageGroupRepository.findById(
    input.tenantId,
    translation.pageGroupId,
  );
  if (!group) {
    return null;
  }

  const site = await deps.siteRepository.findById(
    input.tenantId,
    translation.siteId,
  );
  if (!site) {
    return null;
  }

  let content: PageContent;
  if (translation.isDiverged) {
    if (!translation.divergedContent) {
      throw new Error(
        `Page translation ${translation.id} is diverged but has no divergedContent`,
      );
    }
    content = translation.divergedContent;
  } else {
    content = mergeTranslatedContent(group.content, translation.fieldValues);
  }

  const [siblings, chrome, ancestors, [resolvedContent]] = await Promise.all([
    deps.pageTranslationRepository.listByGroup(input.tenantId, group.id),
    resolveSiteChrome(deps, input.tenantId, site, translation.locale, {
      preview: true,
    }),
    resolvePageGroupAncestors(
      deps,
      input.tenantId,
      translation.locale,
      site.defaultLocale,
      group.parentId,
    ),
    resolvePageContentReferences(deps, input.tenantId, translation.locale, [
      content,
    ]),
  ]);
  const translations = siblings
    .filter((sibling) => sibling.status === 'published')
    .map((sibling) => ({ locale: sibling.locale, slug: sibling.slug }));

  return {
    content: resolvedContent,
    seoMeta: translation.seoMeta,
    locale: translation.locale,
    translations,
    ancestors,
    header: chrome.header,
    footer: chrome.footer,
    headerSticky: chrome.headerSticky,
    site: chrome.site,
  };
}
