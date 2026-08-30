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
import { getPreviewSiteLayoutSectionById } from '@brisk/application';
import type {
  PreviewTokenPort,
  SiteLayoutSectionRepositoryPort,
} from '@brisk/ports';
import { ZodValidationPipe } from '../zod-validation.pipe';
import {
  type PublicSiteLayoutSectionPreviewQuery,
  publicSiteLayoutSectionPreviewQuerySchema,
} from './public-site-layout-sections.schemas';
import {
  DEFAULT_TENANT_ID,
  PREVIEW_TOKEN_PORT,
  SITE_LAYOUT_SECTION_REPOSITORY,
} from './public-site-layout-sections.tokens';

// No SessionAuthGuard on this controller — same public, unauthenticated
// read path as PublicPagesController, gated entirely by the preview token
// itself rather than a session.
@Controller('public/site-layout-sections')
@UseGuards(ThrottlerGuard)
export class PublicSiteLayoutSectionsController {
  constructor(
    @Inject(SITE_LAYOUT_SECTION_REPOSITORY)
    private readonly siteLayoutSectionRepository: SiteLayoutSectionRepositoryPort,
    @Inject(DEFAULT_TENANT_ID) private readonly defaultTenantId: string,
    @Inject(PREVIEW_TOKEN_PORT)
    private readonly previewTokenPort: PreviewTokenPort,
  ) {}

  @Get(':id/preview')
  async preview(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(publicSiteLayoutSectionPreviewQuerySchema))
    query: PublicSiteLayoutSectionPreviewQuery,
  ) {
    const result = await getPreviewSiteLayoutSectionById(
      {
        siteLayoutSectionRepository: this.siteLayoutSectionRepository,
        previewTokenPort: this.previewTokenPort,
      },
      {
        tenantId: this.defaultTenantId,
        sectionId: id,
        token: query.token,
      },
    );
    if (!result) {
      throw new NotFoundException();
    }
    return result;
  }
}
