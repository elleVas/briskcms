import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Inject,
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
import type { SiteLayoutSection } from '@brisk/domain-core';
import {
  type SiteLayoutSectionRecord,
  type SiteLayoutSectionVersionRecord,
  siteLayoutSectionRecordSchema,
  siteLayoutSectionVersionRecordSchema,
} from '@brisk/shared-types';
import type {
  PreviewTokenPort,
  SiteLayoutSectionRepositoryPort,
  SiteLayoutSectionVersionRepositoryPort,
  SiteRepositoryPort,
  TenantContextPort,
} from '@brisk/ports';
import { PREVIEW_TOKEN_TTL_MS } from '../preview-token-ttl.constant';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ZodValidationPipe } from '../zod-validation.pipe';
import {
  type GetOrCreateQuery,
  getOrCreateQuerySchema,
  type RollbackBody,
  rollbackBodySchema,
  type SaveDraftBody,
  saveDraftBodySchema,
  type StickyBody,
  stickyBodySchema,
} from './site-layout-sections.schemas';
import { TENANT_CONTEXT } from '../auth/auth.tokens';
import {
  PREVIEW_TOKEN_PORT,
  SITE_LAYOUT_SECTION_REPOSITORY,
  SITE_LAYOUT_SECTION_VERSION_REPOSITORY,
  SITE_REPOSITORY,
} from './site-layout-sections.tokens';
import { UuidParam } from '../uuid-param.decorator';

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
    return this.toDto(section);
  }

  @Get(':id')
  async findById(@UuidParam('id') id: string) {
    const section = await this.siteLayoutSectionRepository.findById(
      this.tenantContext.getCurrentTenantId(),
      id,
    );
    if (!section) {
      throw new NotFoundException(`Site layout section not found: ${id}`);
    }
    return this.toDto(section);
  }

  @Post(':id/preview-token')
  async createPreviewToken(@UuidParam('id') id: string) {
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
    @UuidParam('id') id: string,
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
    return this.toDto(section);
  }

  @Post(':id/publish')
  async publish(@UuidParam('id') id: string) {
    const section = await publishSiteLayoutSection(
      { siteLayoutSectionRepository: this.siteLayoutSectionRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), id },
    );
    return this.toDto(section);
  }

  @Patch(':id/sticky')
  async updateSticky(
    @UuidParam('id') id: string,
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
    return this.toDto(section);
  }

  @Get(':id/versions')
  async listVersions(
    @UuidParam('id') id: string,
  ): Promise<SiteLayoutSectionVersionRecord[]> {
    const versions = await listSiteLayoutSectionVersions(
      {
        siteLayoutSectionVersionRepository:
          this.siteLayoutSectionVersionRepository,
      },
      { tenantId: this.tenantContext.getCurrentTenantId(), id },
    );
    return versions.map((version) =>
      siteLayoutSectionVersionRecordSchema.parse({
        id: version.id,
        tenantId: version.tenantId,
        siteLayoutSectionId: version.siteLayoutSectionId,
        content: version.content,
        createdBy: version.createdBy,
        createdAt: version.createdAt.toISOString(),
      }),
    );
  }

  @Post(':id/rollback')
  async rollback(
    @UuidParam('id') id: string,
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
    return this.toDto(section);
  }

  /** Whitelisted field by field, never the entity's props spread: a field `SiteLayoutSection` gains later does not leave the server until somebody decides it should. */
  private toDto(section: SiteLayoutSection): SiteLayoutSectionRecord {
    const props = section.toProps();
    return siteLayoutSectionRecordSchema.parse({
      id: props.id,
      tenantId: props.tenantId,
      siteId: props.siteId,
      locale: props.locale,
      kind: props.kind,
      status: props.status,
      content: props.content,
      publishedContent: props.publishedContent,
      sticky: props.sticky,
      createdAt: props.createdAt.toISOString(),
      updatedAt: props.updatedAt.toISOString(),
    });
  }
}
