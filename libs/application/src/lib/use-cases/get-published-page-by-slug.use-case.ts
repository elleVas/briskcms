import type { Block, SeoMeta } from '@brisk/shared-types';
import type {
  PageRepositoryPort,
  SiteLayoutSectionRepositoryPort,
  SiteRepositoryPort,
} from '@brisk/ports';
import {
  resolveSiteChrome,
  type PublishedSite,
} from './resolve-site-chrome.js';
import {
  resolvePageAncestors,
  type PageAncestor,
} from './resolve-page-ancestors.js';

export interface GetPublishedPageBySlugDeps {
  siteRepository: SiteRepositoryPort;
  pageRepository: PageRepositoryPort;
  siteLayoutSectionRepository: SiteLayoutSectionRepositoryPort;
}

export interface GetPublishedPageBySlugInput {
  tenantId: string;
  domain: string;
  locale: string;
  slug: string;
}

/** One entry per published locale-translation of this page (docs/adr/0017) — never includes an unpublished draft translation's slug. */
export interface PublishedPageTranslation {
  locale: string;
  slug: string;
}

/** Root-to-parent order (does not include the page itself). Empty for a root-level page. Alias kept for external consumers — the walk itself lives in resolve-page-ancestors.ts, shared with getPreviewPageById. */
export type PublishedPageAncestor = PageAncestor;

export interface PublishedPage {
  content: Block[];
  seoMeta: SeoMeta;
  locale: string;
  translations: PublishedPageTranslation[];
  ancestors: PublishedPageAncestor[];
  site: PublishedSite;
  // Site-level, not page-level (docs/adr/0018) — resolved for (site, this
  // page's locale) in the same call, `null` when never published (or
  // never configured at all) for that locale, same collapse as
  // page.publishedContent.
  header: Block[] | null;
  footer: Block[] | null;
  // Gated the same way as `header` (only meaningful once a header is
  // actually published) — no footer equivalent, "sticky footer" wasn't
  // asked for.
  headerSticky: boolean;
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

  const page = await deps.pageRepository.findBySlug(
    input.tenantId,
    site.id,
    input.locale,
    input.slug,
  );
  if (!page || page.status !== 'published' || !page.publishedContent) {
    return null;
  }

  const [siblings, chrome, ancestors] = await Promise.all([
    deps.pageRepository.listByGroup(input.tenantId, site.id, page.groupId),
    resolveSiteChrome(deps, input.tenantId, site, input.locale),
    resolvePageAncestors(deps.pageRepository, input.tenantId, page.parentId),
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
