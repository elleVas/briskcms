import type { PublishedPage } from '@brisk/shared-types';
import type {
  PageRepositoryPort,
  SiteLayoutSectionRepositoryPort,
  SiteRepositoryPort,
  SiteThemeBlockStylesPort,
} from '@brisk/ports';
import { resolveSiteChrome } from './resolve-site-chrome';
import { resolvePageByPath } from './resolve-page-by-path';

export type { PublishedPage };

export interface GetPublishedPageBySlugDeps {
  siteRepository: SiteRepositoryPort;
  pageRepository: PageRepositoryPort;
  siteLayoutSectionRepository: SiteLayoutSectionRepositoryPort;
  siteThemeBlockStylesRepository: SiteThemeBlockStylesPort;
}

export interface GetPublishedPageBySlugInput {
  tenantId: string;
  domain: string;
  locale: string;
  /** Full URL path, root to leaf (e.g. ['servizi', 'idraulica']) — sibling-scoped slugs mean the trailing segment alone is ambiguous, see resolvePageByPath. */
  segments: string[];
}

/**
 * The public, unauthenticated read path (see apps/api's PublicPagesModule):
 * only ever returns `publishedContent`, never the draft `content`, and only
 * for a page whose status is actually 'published' — a page that exists but
 * is still a draft is indistinguishable from one that doesn't exist at all,
 * on purpose (no oracle for probing unpublished slugs). Resolves the site
 * from `domain` rather than trusting a client-supplied siteId/tenantId.
 * `locale` is caller-supplied (from the URL's locale prefix, docs/adr/0017)
 * rather than always the site's `defaultLocale` — if that exact
 * (locale, slug) pair has no published page, this returns `null` just like
 * any other not-found slug; it does NOT search sibling locales for the
 * same content, since there is no way to know a not-found page's `groupId`.
 * The language switcher (apps/public-site) instead uses `translations`
 * below, computed only once a page IS found.
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

  const resolved = await resolvePageByPath(
    deps.pageRepository,
    input.tenantId,
    site.id,
    input.locale,
    input.segments,
  );
  if (!resolved) {
    return null;
  }
  const { page, ancestors } = resolved;
  if (page.status !== 'published' || !page.publishedContent) {
    return null;
  }

  const [siblings, chrome] = await Promise.all([
    deps.pageRepository.listByGroup(input.tenantId, site.id, page.groupId),
    resolveSiteChrome(deps, input.tenantId, site, input.locale),
  ]);
  const translations = siblings
    .filter((sibling) => sibling.status === 'published')
    .map((sibling) => ({ locale: sibling.locale, slug: sibling.slug }));

  return {
    content: page.publishedContent,
    seoMeta: page.seoMeta,
    locale: page.locale,
    translations,
    ancestors,
    header: chrome.header,
    footer: chrome.footer,
    headerSticky: chrome.headerSticky,
    site: chrome.site,
  };
}
