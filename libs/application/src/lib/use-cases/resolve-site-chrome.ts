import type {
  Block,
  OpeningHoursDay,
  ThemeSettings,
  ThemeTokens,
  UntranslatedPageFallback,
} from '@brisk/shared-types';
import type { Site, SiteLayoutSection } from '@brisk/domain-core';
import type {
  SiteLayoutSectionRepositoryPort,
  SiteThemeBlockStylesPort,
} from '@brisk/ports';

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
  /** Tier 1 of docs/adr/0021's theming model — layered by PageLayout.astro on top of the active filesystem theme (Tier 2). */
  themeSettings: ThemeSettings;
  /** Global Styles Editor (Fase 2a) — categorie di stile oltre ai colori (Bottoni oggi). */
  themeTokens: ThemeTokens;
}

export interface PublishedSiteChrome {
  site: PublishedSite;
  header: Block[] | null;
  footer: Block[] | null;
  headerSticky: boolean;
}

export interface ResolveSiteChromeDeps {
  siteLayoutSectionRepository: SiteLayoutSectionRepositoryPort;
  siteThemeBlockStylesRepository: SiteThemeBlockStylesPort;
}

/**
 * Una sezione (header/footer) esiste per (sito, locale, kind) — se una
 * locale non ne ha mai avuta una propria (creata solo per la locale di
 * default, es. durante il setup iniziale del sito), senza questo fallback
 * `findBySiteLocaleKind` tornava `null` e la pagina usciva senza header né
 * footer, in ogni locale diversa da quella di default — bug segnalato dal
 * vivo (2026-08-22): una pagina pubblicata in inglese su un sito impostato
 * in italiano perdeva sia la nav che il footer. Stessa idea di
 * `untranslatedPageFallback` per le pagine (mostra il contenuto della
 * locale di default piuttosto che niente), applicata qui a header/footer.
 * Una sezione mai creata per NESSUNA locale resta `null` anche dopo il
 * fallback — non c'è nulla da mostrare in quel caso.
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

  return {
    header: resolveContent(headerSection),
    footer: resolveContent(footerSection),
    headerSticky: preview
      ? (headerSection?.sticky ?? false)
      : headerSection?.status === 'published'
        ? headerSection.sticky
        : false,
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
      themeSettings: site.themeSettings,
      themeTokens: { blockStyles },
    },
  };
}
