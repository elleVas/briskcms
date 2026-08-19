import type {
  Block,
  OpeningHoursDay,
  UntranslatedPageFallback,
} from '@brisk/shared-types';
import type { Site } from '@brisk/domain-core';
import type { SiteLayoutSectionRepositoryPort } from '@brisk/ports';

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

export interface PublishedSiteChrome {
  site: PublishedSite;
  header: Block[] | null;
  footer: Block[] | null;
  headerSticky: boolean;
}

export interface ResolveSiteChromeDeps {
  siteLayoutSectionRepository: SiteLayoutSectionRepositoryPort;
}

/**
 * Shared by getPublishedPageBySlug and getPublishedSiteChrome — resolving
 * header/footer/site depends only on (site, locale), never on which
 * specific page (if any) is being rendered alongside it. Split out so a
 * route with no backing Page row (e.g. apps/public-site's search.astro)
 * can get the site's normal chrome without needing a page to anchor to.
 */
export async function resolveSiteChrome(
  deps: ResolveSiteChromeDeps,
  tenantId: string,
  site: Site,
  locale: string,
): Promise<PublishedSiteChrome> {
  const [headerSection, footerSection] = await Promise.all([
    deps.siteLayoutSectionRepository.findBySiteLocaleKind(
      tenantId,
      site.id,
      locale,
      'header',
    ),
    deps.siteLayoutSectionRepository.findBySiteLocaleKind(
      tenantId,
      site.id,
      locale,
      'footer',
    ),
  ]);

  return {
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
