import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  getPublishedPageBySlug,
  listPublishedPagesForSitemap,
  searchPages,
} from '@brisk/application';
import type {
  PageRepositoryPort,
  SearchPort,
  SiteLayoutSectionRepositoryPort,
  SiteRepositoryPort,
} from '@brisk/ports';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import {
  type PublicPageBySlugQuery,
  publicPageBySlugQuerySchema,
  type PublicPagesSearchQuery,
  publicPagesSearchQuerySchema,
  type PublicPagesSitemapQuery,
  publicPagesSitemapQuerySchema,
} from './public-pages.schemas.js';
import {
  DEFAULT_TENANT_ID,
  PAGE_REPOSITORY,
  SEARCH_REPOSITORY,
  SITE_LAYOUT_SECTION_REPOSITORY,
  SITE_REPOSITORY,
} from './public-pages.tokens.js';

// No SessionAuthGuard on this controller — it's the public, unauthenticated
// read path apps/public-site's SSR calls. Deliberately read-only: there is
// no create/update/delete route here, not just "none exposed in the UI".
@Controller('public/pages')
@UseGuards(ThrottlerGuard)
export class PublicPagesController {
  constructor(
    @Inject(PAGE_REPOSITORY)
    private readonly pageRepository: PageRepositoryPort,
    @Inject(SITE_REPOSITORY)
    private readonly siteRepository: SiteRepositoryPort,
    @Inject(SITE_LAYOUT_SECTION_REPOSITORY)
    private readonly siteLayoutSectionRepository: SiteLayoutSectionRepositoryPort,
    @Inject(SEARCH_REPOSITORY)
    private readonly searchPort: SearchPort,
    @Inject(DEFAULT_TENANT_ID) private readonly defaultTenantId: string,
  ) {}

  @Get('by-slug')
  async findBySlug(
    @Query(new ZodValidationPipe(publicPageBySlugQuerySchema))
    query: PublicPageBySlugQuery,
  ) {
    const result = await getPublishedPageBySlug(
      {
        siteRepository: this.siteRepository,
        pageRepository: this.pageRepository,
        siteLayoutSectionRepository: this.siteLayoutSectionRepository,
      },
      {
        tenantId: this.defaultTenantId,
        domain: query.domain,
        locale: query.locale,
        slug: query.slug,
      },
    );
    // A draft page and a page that doesn't exist get the identical 404 —
    // getPublishedPageBySlug already collapses both cases into `null`, so
    // there's no way for this handler to tell them apart even if it wanted
    // to (see the use case's own comment on why that's deliberate).
    if (!result) {
      throw new NotFoundException();
    }
    return result;
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
        pageRepository: this.pageRepository,
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
