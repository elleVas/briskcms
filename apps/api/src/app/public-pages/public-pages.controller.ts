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
} from '@brisk/application';
import type { PageRepositoryPort, SiteRepositoryPort } from '@brisk/ports';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import {
  type PublicPageBySlugQuery,
  publicPageBySlugQuerySchema,
  type PublicPagesSitemapQuery,
  publicPagesSitemapQuerySchema,
} from './public-pages.schemas.js';
import {
  DEFAULT_TENANT_ID,
  PAGE_REPOSITORY,
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
      },
      {
        tenantId: this.defaultTenantId,
        domain: query.domain,
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

  @Get()
  async listForSitemap(
    @Query(new ZodValidationPipe(publicPagesSitemapQuerySchema))
    query: PublicPagesSitemapQuery,
  ) {
    const items = await listPublishedPagesForSitemap(
      {
        siteRepository: this.siteRepository,
        pageRepository: this.pageRepository,
      },
      { tenantId: this.defaultTenantId, domain: query.domain },
    );
    // An unrecognized domain renders as an empty sitemap, not a 404 — see
    // listPublishedPagesForSitemap's own comment on why.
    return { items: items ?? [] };
  }
}
