import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  getOrCreateSiteLayoutSection,
  listSiteLayoutSectionVersions,
  publishSiteLayoutSection,
  rollbackSiteLayoutSectionToVersion,
  saveSiteLayoutSectionDraft,
  updateSiteLayoutSectionSticky,
} from '@brisk/application';
import type {
  PreviewTokenPort,
  SiteLayoutSectionRepositoryPort,
  SiteLayoutSectionVersionRepositoryPort,
  SiteRepositoryPort,
  TenantContextPort,
} from '@brisk/ports';
import { PREVIEW_TOKEN_TTL_MS } from '../preview-token-ttl.constant.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import {
  type GetOrCreateQuery,
  getOrCreateQuerySchema,
  type RollbackBody,
  rollbackBodySchema,
  type SaveDraftBody,
  saveDraftBodySchema,
  type StickyBody,
  stickyBodySchema,
} from './site-layout-sections.schemas.js';
import { TENANT_CONTEXT } from '../auth/auth.tokens.js';
import {
  PREVIEW_TOKEN_PORT,
  SITE_LAYOUT_SECTION_REPOSITORY,
  SITE_LAYOUT_SECTION_VERSION_REPOSITORY,
  SITE_REPOSITORY,
} from './site-layout-sections.tokens.js';

@Controller('site-layout-sections')
@UseGuards(SessionAuthGuard)
export class SiteLayoutSectionsController {
  constructor(
    @Inject(SITE_LAYOUT_SECTION_REPOSITORY)
    private readonly siteLayoutSectionRepository: SiteLayoutSectionRepositoryPort,
    @Inject(SITE_LAYOUT_SECTION_VERSION_REPOSITORY)
    private readonly siteLayoutSectionVersionRepository: SiteLayoutSectionVersionRepositoryPort,
    @Inject(SITE_REPOSITORY)
    private readonly siteRepository: SiteRepositoryPort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
    @Inject(PREVIEW_TOKEN_PORT)
    private readonly previewTokenPort: PreviewTokenPort,
  ) {}

  @Get()
  async getOrCreate(
    @Query(new ZodValidationPipe(getOrCreateQuerySchema))
    query: GetOrCreateQuery,
  ) {
    const section = await getOrCreateSiteLayoutSection(
      {
        siteRepository: this.siteRepository,
        siteLayoutSectionRepository: this.siteLayoutSectionRepository,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: query.siteId,
        locale: query.locale,
        kind: query.kind,
      },
    );
    return section.toProps();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const section = await this.siteLayoutSectionRepository.findById(
      this.tenantContext.getCurrentTenantId(),
      id,
    );
    if (!section) {
      throw new NotFoundException(`Site layout section not found: ${id}`);
    }
    return section.toProps();
  }

  @Post(':id/preview-token')
  async createPreviewToken(@Param('id') id: string) {
    const section = await this.siteLayoutSectionRepository.findById(
      this.tenantContext.getCurrentTenantId(),
      id,
    );
    if (!section) {
      throw new NotFoundException(`Site layout section not found: ${id}`);
    }
    const { token, expiresAt } = await this.previewTokenPort.createToken(
      this.tenantContext.getCurrentTenantId(),
      section.kind,
      id,
      PREVIEW_TOKEN_TTL_MS,
    );
    return { token, expiresAt };
  }

  @Patch(':id/draft')
  async saveDraft(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveDraftBodySchema)) body: SaveDraftBody,
  ) {
    const section = await saveSiteLayoutSectionDraft(
      {
        siteLayoutSectionRepository: this.siteLayoutSectionRepository,
        siteLayoutSectionVersionRepository:
          this.siteLayoutSectionVersionRepository,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        id,
        content: body.content,
        actorUserId: null,
      },
    );
    return section.toProps();
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string) {
    const section = await publishSiteLayoutSection(
      { siteLayoutSectionRepository: this.siteLayoutSectionRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), id },
    );
    return section.toProps();
  }

  @Patch(':id/sticky')
  async updateSticky(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(stickyBodySchema)) body: StickyBody,
  ) {
    const section = await updateSiteLayoutSectionSticky(
      { siteLayoutSectionRepository: this.siteLayoutSectionRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        id,
        sticky: body.sticky,
      },
    );
    return section.toProps();
  }

  @Get(':id/versions')
  async listVersions(@Param('id') id: string) {
    return listSiteLayoutSectionVersions(
      {
        siteLayoutSectionVersionRepository:
          this.siteLayoutSectionVersionRepository,
      },
      { tenantId: this.tenantContext.getCurrentTenantId(), id },
    );
  }

  @Post(':id/rollback')
  async rollback(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rollbackBodySchema)) body: RollbackBody,
  ) {
    const section = await rollbackSiteLayoutSectionToVersion(
      {
        siteLayoutSectionRepository: this.siteLayoutSectionRepository,
        siteLayoutSectionVersionRepository:
          this.siteLayoutSectionVersionRepository,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        id,
        versionId: body.versionId,
        actorUserId: null,
      },
    );
    return section.toProps();
  }
}
