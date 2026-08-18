import type { Block, SeoMeta } from '@brisk/shared-types';
import type { PageRepositoryPort, SiteRepositoryPort } from '@brisk/ports';

export interface GetPublishedPageBySlugDeps {
  siteRepository: SiteRepositoryPort;
  pageRepository: PageRepositoryPort;
}

export interface GetPublishedPageBySlugInput {
  tenantId: string;
  domain: string;
  slug: string;
}

export interface PublishedPage {
  content: Block[];
  seoMeta: SeoMeta;
  locale: string;
}

/**
 * The public, unauthenticated read path (see apps/api's PublicPagesModule):
 * only ever returns `publishedContent`, never the draft `content`, and only
 * for a page whose status is actually 'published' — a page that exists but
 * is still a draft is indistinguishable from one that doesn't exist at all,
 * on purpose (no oracle for probing unpublished slugs). Resolves the site
 * from `domain` rather than trusting a client-supplied siteId/tenantId, and
 * always renders in the site's own `defaultLocale` — per-locale routing is
 * out of scope until multilingua (see piano-progetto-astro-cms.md, Fase 5b).
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
    site.defaultLocale,
    input.slug,
  );
  if (!page || page.status !== 'published' || !page.publishedContent) {
    return null;
  }

  return {
    content: page.publishedContent,
    seoMeta: page.seoMeta,
    locale: page.locale,
  };
}
