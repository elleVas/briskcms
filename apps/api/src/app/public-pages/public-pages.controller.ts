import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  DEPLOYMENT_TENANT_RESOLVER,
  DeploymentTenantResolver,
} from '../deployment-tenant.resolver';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  getPreviewPageById,
  getPreviewReusableSectionById,
  getPublishedPageBySlug,
  getPublishedSiteChrome,
  getPublishedTermByPath,
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
  ReusableSectionRepositoryPort,
  SiteRepositoryPort,
  SiteThemeBlockStylesPort,
  TaxonomyRepositoryPort,
} from '@brisk/ports';
import { ZodValidationPipe } from '../zod-validation.pipe';
import {
  type PublicPageBySlugQuery,
  publicPageBySlugQuerySchema,
  type PublicPagePreviewQuery,
  publicPagePreviewQuerySchema,
  type PublicSectionPreviewQuery,
  publicSectionPreviewQuerySchema,
  type PublicPagesChromeQuery,
  publicPagesChromeQuerySchema,
  type PublicPagesSearchQuery,
  publicPagesSearchQuerySchema,
  type PublicPagesSitemapQuery,
  publicPagesSitemapQuerySchema,
  type PublicPagesTreeQuery,
  publicPagesTreeQuerySchema,
  type PublicTermByPathQuery,
  publicTermByPathQuerySchema,
} from './public-pages.schemas';
import {
  PAGE_GROUP_REPOSITORY,
  PAGE_TRANSLATION_REPOSITORY,
  PREVIEW_TOKEN_PORT,
  REUSABLE_SECTION_REPOSITORY,
  SEARCH_REPOSITORY,
  SITE_LAYOUT_SECTION_REPOSITORY,
  SITE_REPOSITORY,
  SITE_THEME_BLOCK_STYLES_REPOSITORY,
  TAXONOMY_REPOSITORY,
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
    @Inject(TAXONOMY_REPOSITORY)
    private readonly taxonomyRepository: TaxonomyRepositoryPort,
    @Inject(REUSABLE_SECTION_REPOSITORY)
    private readonly reusableSectionRepository: ReusableSectionRepositoryPort,
    @Inject(SEARCH_REPOSITORY)
    private readonly searchPort: SearchPort,
    @Inject(DEPLOYMENT_TENANT_RESOLVER)
    private readonly tenant: DeploymentTenantResolver,
    @Inject(PREVIEW_TOKEN_PORT)
    private readonly previewTokenPort: PreviewTokenPort,
  ) {}

  /**
   * A term's own page (docs/adr/0064).
   *
   * A separate endpoint rather than a branch inside `by-slug`: the two
   * lookups answer different questions, and apps/public-site asks this
   * one only after the page lookup has come back empty — which is what
   * makes "a page always wins" true at render time, not only at write
   * time.
   */
  @Get('term-by-path')
  async findTermByPath(
    @Query(new ZodValidationPipe(publicTermByPathQuerySchema))
    query: PublicTermByPathQuery,
  ) {
    const term = await getPublishedTermByPath(
      {
        siteRepository: this.siteRepository,
        taxonomyRepository: this.taxonomyRepository,
        pageGroupRepository: this.pageGroupRepository,
        pageTranslationRepository: this.pageTranslationRepository,
        siteLayoutSectionRepository: this.siteLayoutSectionRepository,
        siteThemeBlockStylesRepository: this.siteThemeBlockStylesRepository,
        reusableSectionRepository: this.reusableSectionRepository,
      },
      {
        tenantId: await this.tenant.require(),
        domain: query.domain,
        locale: query.locale,
        segments: query.path,
      },
    );
    if (!term) {
      throw new NotFoundException('Term not found');
    }
    return term;
  }

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
        reusableSectionRepository: this.reusableSectionRepository,
      },
      {
        tenantId: await this.tenant.require(),
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
          tenantId: await this.tenant.require(),
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
        reusableSectionRepository: this.reusableSectionRepository,
        previewTokenPort: this.previewTokenPort,
      },
      {
        tenantId: await this.tenant.require(),
        pageId: id,
        token: query.token,
      },
    );
    // The same "indistinguishable from non-existent" posture as findBySlug:
    // a missing, expired or mismatched token and a page that does not exist
    // all get the same 404, giving no oracle for guessing valid page ids.
    if (!result) {
      throw new NotFoundException();
    }
    return result;
  }

  /**
   * The section editor's canvas. A route of its own rather than a flag on
   * the page preview: it validates a token minted for a SECTION, so a page
   * token can never reach it and vice versa.
   */
  @Get('sections/:id/preview')
  async previewSection(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(publicSectionPreviewQuerySchema))
    query: PublicSectionPreviewQuery,
  ) {
    const result = await getPreviewReusableSectionById(
      {
        previewTokenPort: this.previewTokenPort,
        reusableSectionRepository: this.reusableSectionRepository,
        pageGroupRepository: this.pageGroupRepository,
        pageTranslationRepository: this.pageTranslationRepository,
        siteRepository: this.siteRepository,
        siteLayoutSectionRepository: this.siteLayoutSectionRepository,
        siteThemeBlockStylesRepository: this.siteThemeBlockStylesRepository,
      },
      {
        tenantId: await this.tenant.require(),
        id,
        token: query.token,
        locale: query.locale,
      },
    );
    // The same collapse as every other preview: missing, expired,
    // mismatched or non-existent all answer 404.
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
        reusableSectionRepository: this.reusableSectionRepository,
        pageTranslationRepository: this.pageTranslationRepository,
        pageGroupRepository: this.pageGroupRepository,
      },
      {
        tenantId: await this.tenant.require(),
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
        tenantId: await this.tenant.require(),
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
        tenantId: await this.tenant.require(),
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
      { tenantId: await this.tenant.require(), domain: query.domain },
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
