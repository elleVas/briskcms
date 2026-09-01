import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  getPreviewPageById,
  getPublishedPageBySlug,
  getPublishedSiteChrome,
  listPublishedPagesForSitemap,
  listPublishedPageTree,
  resolveUntranslatedPageFallback,
  searchPages,
} from '@brisk/application';
import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
  PreviewTokenPort,
  SearchPort,
  SiteLayoutSectionRepositoryPort,
  SiteRepositoryPort,
  SiteThemeBlockStylesPort,
} from '@brisk/ports';
import { ZodValidationPipe } from '../zod-validation.pipe';
import {
  type PublicPageBySlugQuery,
  publicPageBySlugQuerySchema,
  type PublicPagePreviewQuery,
  publicPagePreviewQuerySchema,
  type PublicPagesChromeQuery,
  publicPagesChromeQuerySchema,
  type PublicPagesSearchQuery,
  publicPagesSearchQuerySchema,
  type PublicPagesSitemapQuery,
  publicPagesSitemapQuerySchema,
  type PublicPagesTreeQuery,
  publicPagesTreeQuerySchema,
} from './public-pages.schemas';
import {
  DEFAULT_TENANT_ID,
  PAGE_GROUP_REPOSITORY,
  PAGE_TRANSLATION_REPOSITORY,
  PREVIEW_TOKEN_PORT,
  SEARCH_REPOSITORY,
  SITE_LAYOUT_SECTION_REPOSITORY,
  SITE_REPOSITORY,
  SITE_THEME_BLOCK_STYLES_REPOSITORY,
} from './public-pages.tokens';

// No SessionAuthGuard on this controller — it's the public, unauthenticated
// read path apps/public-site's SSR calls. Deliberately read-only: there is
// no create/update/delete route here, not just "none exposed in the UI".
@Controller('public/pages')
@UseGuards(ThrottlerGuard)
export class PublicPagesController {
  constructor(
    @Inject(PAGE_GROUP_REPOSITORY)
    private readonly pageGroupRepository: PageGroupRepositoryPort,
    @Inject(PAGE_TRANSLATION_REPOSITORY)
    private readonly pageTranslationRepository: PageTranslationRepositoryPort,
    @Inject(SITE_REPOSITORY)
    private readonly siteRepository: SiteRepositoryPort,
    @Inject(SITE_LAYOUT_SECTION_REPOSITORY)
    private readonly siteLayoutSectionRepository: SiteLayoutSectionRepositoryPort,
    @Inject(SITE_THEME_BLOCK_STYLES_REPOSITORY)
    private readonly siteThemeBlockStylesRepository: SiteThemeBlockStylesPort,
    @Inject(SEARCH_REPOSITORY)
    private readonly searchPort: SearchPort,
    @Inject(DEFAULT_TENANT_ID) private readonly defaultTenantId: string,
    @Inject(PREVIEW_TOKEN_PORT)
    private readonly previewTokenPort: PreviewTokenPort,
  ) {}

  @Get('by-slug')
  async findBySlug(
    @Query(new ZodValidationPipe(publicPageBySlugQuerySchema))
    query: PublicPageBySlugQuery,
  ) {
    const result = await getPublishedPageBySlug(
      {
        siteRepository: this.siteRepository,
        pageGroupRepository: this.pageGroupRepository,
        pageTranslationRepository: this.pageTranslationRepository,
        siteLayoutSectionRepository: this.siteLayoutSectionRepository,
        siteThemeBlockStylesRepository: this.siteThemeBlockStylesRepository,
      },
      {
        tenantId: this.defaultTenantId,
        domain: query.domain,
        locale: query.locale,
        segments: query.path,
      },
    );
    // A draft page and a page that doesn't exist get the identical 404 —
    // getPublishedPageBySlug already collapses both cases into `null`, so
    // there's no way for this handler to tell them apart even if it wanted
    // to (see the use case's own comment on why that's deliberate).
    if (!result) {
      // Direct navigation/old link/crawler on a (locale, slug) that was
      // never translated — the language switcher can't help here, it only
      // computes a fallback once a page IS found. `fallback` is `null` when
      // there's nowhere better to send the visitor (site set to
      // 'not-available', or the default-locale page doesn't exist either):
      // apps/public-site renders a real 404 in that case, same as today.
      const fallback = await resolveUntranslatedPageFallback(
        {
          siteRepository: this.siteRepository,
          pageGroupRepository: this.pageGroupRepository,
          pageTranslationRepository: this.pageTranslationRepository,
        },
        {
          tenantId: this.defaultTenantId,
          domain: query.domain,
          locale: query.locale,
          segments: query.path,
        },
      );
      throw new NotFoundException({ fallback });
    }
    return result;
  }

  @Get(':id/preview')
  async preview(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(publicPagePreviewQuerySchema))
    query: PublicPagePreviewQuery,
  ) {
    const result = await getPreviewPageById(
      {
        pageGroupRepository: this.pageGroupRepository,
        pageTranslationRepository: this.pageTranslationRepository,
        siteRepository: this.siteRepository,
        siteLayoutSectionRepository: this.siteLayoutSectionRepository,
        siteThemeBlockStylesRepository: this.siteThemeBlockStylesRepository,
        previewTokenPort: this.previewTokenPort,
      },
      {
        tenantId: this.defaultTenantId,
        pageId: id,
        token: query.token,
      },
    );
    // Stessa postura "indistinguibile dal non-esistente" di findBySlug: un
    // token mancante/scaduto/mismatch e una pagina che non esiste ricevono
    // lo stesso 404, nessun oracolo per indovinare id di pagina validi.
    if (!result) {
      throw new NotFoundException();
    }
    return result;
  }

  @Get('chrome')
  async chrome(
    @Query(new ZodValidationPipe(publicPagesChromeQuerySchema))
    query: PublicPagesChromeQuery,
  ) {
    const result = await getPublishedSiteChrome(
      {
        siteRepository: this.siteRepository,
        siteLayoutSectionRepository: this.siteLayoutSectionRepository,
        siteThemeBlockStylesRepository: this.siteThemeBlockStylesRepository,
        pageTranslationRepository: this.pageTranslationRepository,
      },
      {
        tenantId: this.defaultTenantId,
        domain: query.domain,
        locale: query.locale,
      },
    );
    // Same "nothing to show" collapse as findBySlug: an unrecognized
    // domain has no site to derive chrome from at all, 404 not a
    // graceful empty default — unlike search/listForSitemap below, there
    // is no sensible "chrome" a caller could render for a domain that
    // doesn't exist.
    if (!result) {
      throw new NotFoundException();
    }
    return result;
  }

  @Get('tree')
  async tree(
    @Query(new ZodValidationPipe(publicPagesTreeQuerySchema))
    query: PublicPagesTreeQuery,
  ) {
    const result = await listPublishedPageTree(
      {
        siteRepository: this.siteRepository,
        pageGroupRepository: this.pageGroupRepository,
        pageTranslationRepository: this.pageTranslationRepository,
      },
      {
        tenantId: this.defaultTenantId,
        domain: query.domain,
        locale: query.locale,
      },
    );
    // Same "nothing to show" collapse as search/listForSitemap — an
    // unrecognized domain has nothing to build a nav tree from, and a
    // theme's sidebar has nowhere useful to send a 404 to anyway.
    return { items: result ?? [] };
  }

  @Get('search')
  async search(
    @Query(new ZodValidationPipe(publicPagesSearchQuerySchema))
    query: PublicPagesSearchQuery,
  ) {
    const result = await searchPages(
      { siteRepository: this.siteRepository, searchPort: this.searchPort },
      {
        tenantId: this.defaultTenantId,
        domain: query.domain,
        locale: query.locale,
        query: query.q,
      },
    );
    // An unrecognized domain returns an empty result list, not a 404 —
    // same "nothing to show" collapse as listForSitemap below, and a
    // search box has nowhere useful to send a 404 to anyway.
    return { items: result ?? [] };
  }

  @Get()
  async listForSitemap(
    @Query(new ZodValidationPipe(publicPagesSitemapQuerySchema))
    query: PublicPagesSitemapQuery,
  ) {
    const result = await listPublishedPagesForSitemap(
      {
        siteRepository: this.siteRepository,
        pageGroupRepository: this.pageGroupRepository,
        pageTranslationRepository: this.pageTranslationRepository,
      },
      { tenantId: this.defaultTenantId, domain: query.domain },
    );
    // An unrecognized domain renders as an empty, indexing-allowed
    // sitemap/robots response, not a 404 — see listPublishedPagesForSitemap's
    // own comment on why, and docs/adr/0016 for the indexing-allowed default.
    // `defaultLocale` has no real answer here (there's no site to derive it
    // from) — 'it' is a harmless placeholder since `items` is always empty
    // in this branch, so nothing ever actually reads it as a locale prefix.
    return (
      result ?? {
        items: [],
        searchEngineIndexingEnabled: true,
        defaultLocale: 'it',
      }
    );
  }
}
