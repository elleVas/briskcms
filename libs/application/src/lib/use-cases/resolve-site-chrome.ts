import type { Block, PublishedSite } from '@brisk/shared-types';
import type { Site, SiteLayoutSection } from '@brisk/domain-core';
import type {
  PageTranslationRepositoryPort,
  SiteLayoutSectionRepositoryPort,
  SiteThemeBlockStylesPort,
} from '@brisk/ports';
import { resolvePageContentReferences } from './resolve-page-content-references';

export type { PublishedSite };

export interface PublishedSiteChrome {
  site: PublishedSite;
  header: Block[] | null;
  footer: Block[] | null;
  headerSticky: boolean;
}

export interface ResolveSiteChromeDeps {
  siteLayoutSectionRepository: SiteLayoutSectionRepositoryPort;
  siteThemeBlockStylesRepository: SiteThemeBlockStylesPort;
  pageTranslationRepository: PageTranslationRepositoryPort;
}

/**
 * Resolves a cookie banner policy link (docs/adr/0039) to THIS locale's own
 * published slug — `null` when unset, not yet translated into this locale,
 * or still a draft: a link to an unpublished page must never leak to the
 * public site, same rule already applied to header/footer sections above.
 */
async function resolvePolicySlug(
  pageTranslationRepository: PageTranslationRepositoryPort,
  tenantId: string,
  pageGroupId: string | null,
  locale: string,
): Promise<string | null> {
  if (!pageGroupId) {
    return null;
  }
  const translation = await pageTranslationRepository.findByGroupAndLocale(
    tenantId,
    pageGroupId,
    locale,
  );
  return translation?.status === 'published' ? translation.slug : null;
}

/**
 * A section (header or footer) exists per (site, locale, kind) — when a
 * locale never had one of its own (created only for the default locale,
 * during the site's initial setup for instance), without this fallback
 * `findBySiteLocaleKind` returned `null` and the page came out with neither
 * header nor footer, in every locale other than the default one — a bug
 * reported live (2026-08-22): a page published in English on a site set up
 * in Italian lost both the nav and the footer. The same idea as
 * `untranslatedPageFallback` for pages (show the default locale's content
 * rather than nothing), applied here to the header and footer. A section
 * never created for ANY locale stays `null` even after the fallback — there
 * is nothing to show in that case.
 */
async function findSectionWithLocaleFallback(
  repository: SiteLayoutSectionRepositoryPort,
  tenantId: string,
  site: Site,
  locale: string,
  kind: 'header' | 'footer',
): Promise<SiteLayoutSection | null> {
  const section = await repository.findBySiteLocaleKind(
    tenantId,
    site.id,
    locale,
    kind,
  );
  if (section || locale === site.defaultLocale) {
    return section;
  }
  return repository.findBySiteLocaleKind(
    tenantId,
    site.id,
    site.defaultLocale,
    kind,
  );
}

/**
 * Shared by getPublishedPageBySlug and getPublishedSiteChrome — resolving
 * header/footer/site depends only on (site, locale), never on which
 * specific page (if any) is being rendered alongside it. Split out so a
 * route with no backing Page row (e.g. apps/public-site's search.astro)
 * can get the site's normal chrome without needing a page to anchor to.
 *
 * `preview: true` (used only by getPreviewPageById, gated on that page's own
 * valid preview token — vedi il piano dell'editor visuale, Giorno 1) reads
 * each section's draft `content` regardless of its own `status`, instead of
 * the published-only collapse below. A section that was never created at
 * all still resolves to `null` either way — there is nothing to preview.
 */
export async function resolveSiteChrome(
  deps: ResolveSiteChromeDeps,
  tenantId: string,
  site: Site,
  locale: string,
  options: { preview?: boolean } = {},
): Promise<PublishedSiteChrome> {
  const preview = options.preview ?? false;
  const [headerSection, footerSection, blockStyles] = await Promise.all([
    findSectionWithLocaleFallback(
      deps.siteLayoutSectionRepository,
      tenantId,
      site,
      locale,
      'header',
    ),
    findSectionWithLocaleFallback(
      deps.siteLayoutSectionRepository,
      tenantId,
      site,
      locale,
      'footer',
    ),
    deps.siteThemeBlockStylesRepository.listBySite(tenantId, site.id),
  ]);

  function resolveContent(section: typeof headerSection): Block[] | null {
    if (!section) {
      return null;
    }
    return preview
      ? section.content
      : section.status === 'published'
        ? section.publishedContent
        : null;
  }

  const header = resolveContent(headerSection);
  const footer = resolveContent(footerSection);
  // NavLink lives in header/footer above all else — resolve any `page`
  // reference in both for this locale (see resolve-page-content-references.ts).
  const [resolvedHeader, resolvedFooter] = await resolvePageContentReferences(
    deps,
    tenantId,
    locale,
    [header ?? [], footer ?? []],
  );

  const [privacyPolicySlug, cookiePolicySlug] = await Promise.all([
    resolvePolicySlug(
      deps.pageTranslationRepository,
      tenantId,
      site.cookieBannerSettings.privacyPolicyPageGroupId,
      locale,
    ),
    resolvePolicySlug(
      deps.pageTranslationRepository,
      tenantId,
      site.cookieBannerSettings.cookiePolicyPageGroupId,
      locale,
    ),
  ]);

  return {
    header: header ? resolvedHeader : null,
    footer: footer ? resolvedFooter : null,
    headerSticky: preview
      ? (headerSection?.sticky ?? false)
      : headerSection?.status === 'published'
        ? headerSection.sticky
        : false,
    site: {
      name: site.name,
      domain: site.domain,
      themeName: site.themeName,
      defaultLocale: site.defaultLocale,
      enabledLocales: site.enabledLocales,
      untranslatedPageFallback: site.untranslatedPageFallback,
      businessAddress: site.businessAddress,
      businessPhone: site.businessPhone,
      businessType: site.businessType,
      openingHours: site.openingHours,
      searchEngineIndexingEnabled: site.searchEngineIndexingEnabled,
      themeSettings: site.themeSettings,
      themeTokens: { blockStyles },
      cookieBannerSettings: site.cookieBannerSettings,
      privacyPolicySlug,
      cookiePolicySlug,
    },
  };
}
