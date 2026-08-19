import type {
  Block,
  OpeningHoursDay,
  SeoMeta,
  UntranslatedPageFallback,
} from '@brisk/shared-types';
import type {
  PageRepositoryPort,
  SiteLayoutSectionRepositoryPort,
  SiteRepositoryPort,
} from '@brisk/ports';

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

/** Only what the public renderer needs for OG tags + schema.org (docs/adr/0014) and the language switcher (docs/adr/0017) — never the tenant id or anything else internal. */
export interface PublishedSite {
  name: string;
  domain: string | null;
  defaultLocale: string;
  enabledLocales: string[];
  untranslatedPageFallback: UntranslatedPageFallback;
  businessAddress: string | null;
  businessPhone: string | null;
  businessType: string | null;
  openingHours: OpeningHoursDay[] | null;
  searchEngineIndexingEnabled: boolean;
}

/** One entry per published locale-translation of this page (docs/adr/0017) — never includes an unpublished draft translation's slug. */
export interface PublishedPageTranslation {
  locale: string;
  slug: string;
}

export interface PublishedPage {
  content: Block[];
  seoMeta: SeoMeta;
  locale: string;
  translations: PublishedPageTranslation[];
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

  const [siblings, headerSection, footerSection] = await Promise.all([
    deps.pageRepository.listByGroup(input.tenantId, site.id, page.groupId),
    deps.siteLayoutSectionRepository.findBySiteLocaleKind(
      input.tenantId,
      site.id,
      input.locale,
      'header',
    ),
    deps.siteLayoutSectionRepository.findBySiteLocaleKind(
      input.tenantId,
      site.id,
      input.locale,
      'footer',
    ),
  ]);
  const translations = siblings
    .filter((sibling) => sibling.status === 'published')
    .map((sibling) => ({ locale: sibling.locale, slug: sibling.slug }));

  return {
    content: page.publishedContent,
    seoMeta: page.seoMeta,
    locale: page.locale,
    translations,
    header:
      headerSection?.status === 'published'
        ? headerSection.publishedContent
        : null,
    footer:
      footerSection?.status === 'published'
        ? footerSection.publishedContent
        : null,
    headerSticky:
      headerSection?.status === 'published' ? headerSection.sticky : false,
    site: {
      name: site.name,
      domain: site.domain,
      defaultLocale: site.defaultLocale,
      enabledLocales: site.enabledLocales,
      untranslatedPageFallback: site.untranslatedPageFallback,
      businessAddress: site.businessAddress,
      businessPhone: site.businessPhone,
      businessType: site.businessType,
      openingHours: site.openingHours,
      searchEngineIndexingEnabled: site.searchEngineIndexingEnabled,
    },
  };
}
