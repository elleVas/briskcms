import type { PublishedPage } from '@brisk/shared-types';
import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
  SiteLayoutSectionRepositoryPort,
  SiteRepositoryPort,
  SiteThemeBlockStylesPort,
} from '@brisk/ports';
import { resolveSiteChrome } from './resolve-site-chrome';
import { resolvePageGroupByPath } from './resolve-page-group-by-path';
import { resolvePageContentReferences } from './resolve-page-content-references';

export type { PublishedPage };

export interface GetPublishedPageBySlugDeps {
  siteRepository: SiteRepositoryPort;
  pageGroupRepository: PageGroupRepositoryPort;
  pageTranslationRepository: PageTranslationRepositoryPort;
  siteLayoutSectionRepository: SiteLayoutSectionRepositoryPort;
  siteThemeBlockStylesRepository: SiteThemeBlockStylesPort;
}

export interface GetPublishedPageBySlugInput {
  tenantId: string;
  domain: string;
  locale: string;
  /** Full URL path, root to leaf (e.g. ['servizi', 'idraulica']) — sibling-scoped slugs mean the trailing segment alone is ambiguous, see resolvePageGroupByPath. */
  segments: string[];
}

/**
 * i18n a livello di campo (see the plan) — replaces the old Page-based
 * implementation. `content` is always `translation.publishedSnapshot`
 * (frozen at the last publish(), see PageTranslation's own doc comment),
 * NEVER a live merge of PageGroup.content + fieldValues: a draft
 * structural edit on the group must not leak into what a visitor sees
 * before that translation is explicitly republished, same "draft vs.
 * published" wall the old model had. Same public-read posture as before
 * otherwise: only ever published content, resolves the site from `domain`
 * rather than trusting a client-supplied id, `locale` is caller-supplied
 * and never searches sibling locales itself (see
 * resolveUntranslatedPageFallback for that).
 */
export async function getPublishedPageBySlug(
  deps: GetPublishedPageBySlugDeps,
  input: GetPublishedPageBySlugInput,
): Promise<PublishedPage | null> {
  const site = await deps.siteRepository.findByDomain(
    input.tenantId,
    input.domain,
  );
  if (!site) {
    return null;
  }

  const resolved = await resolvePageGroupByPath(
    {
      pageGroupRepository: deps.pageGroupRepository,
      pageTranslationRepository: deps.pageTranslationRepository,
    },
    input.tenantId,
    site.id,
    input.locale,
    input.segments,
  );
  if (!resolved) {
    return null;
  }
  const { translation, ancestors } = resolved;
  if (translation.status !== 'published' || !translation.publishedSnapshot) {
    return null;
  }

  const [siblings, chrome, [resolvedContent]] = await Promise.all([
    deps.pageTranslationRepository.listByGroup(
      input.tenantId,
      translation.pageGroupId,
    ),
    resolveSiteChrome(deps, input.tenantId, site, input.locale),
    resolvePageContentReferences(deps, input.tenantId, input.locale, [
      translation.publishedSnapshot,
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
