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

// Safety net only — real sites are 1-3 levels deep (see the "5-15 pagine
// per sito" assumption used throughout this codebase), this guards
// against an unexpected cycle looping forever rather than a realistic
// depth.
const MAX_ANCESTOR_WALK = 20;

/** Walks parentId one hop at a time via findById — fine at this product's scale (a handful of hops at most), not worth fetching the whole site's page list just to resolve one page's ancestors. Root-to-parent order. */
async function resolveAncestors(
  pageRepository: PageRepositoryPort,
  tenantId: string,
  parentId: string | null,
): Promise<PublishedPageAncestor[]> {
  const ancestors: PublishedPageAncestor[] = [];
  let currentId = parentId;
  for (
    let hops = 0;
    currentId !== null && hops < MAX_ANCESTOR_WALK;
    hops += 1
  ) {
    const current = await pageRepository.findById(tenantId, currentId);
    if (!current) break;
    ancestors.unshift({
      slug: current.slug,
      title: current.seoMeta.title || current.slug,
    });
    currentId = current.parentId;
  }
  return ancestors;
}

/** One entry per published locale-translation of this page (docs/adr/0017) — never includes an unpublished draft translation's slug. */
export interface PublishedPageTranslation {
  locale: string;
  slug: string;
}

/** Root-to-parent order (does not include the page itself). Empty for a root-level page. */
export interface PublishedPageAncestor {
  slug: string;
  title: string;
}

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
    resolveAncestors(deps.pageRepository, input.tenantId, page.parentId),
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
