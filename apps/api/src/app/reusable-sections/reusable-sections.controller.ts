import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createReusableSection,
  deleteReusableSection,
  getReusableSection,
  listReusableSectionVersions,
  listReusableSections,
  publishReusableSection,
  renameReusableSection,
  rollbackReusableSectionToVersion,
  saveReusableSectionDraft,
  setReusableSectionExposedFields,
} from '@brisk/application';
import type {
  PageTranslationRepositoryPort,
  PreviewTokenPort,
  ReusableSectionRepositoryPort,
  ReusableSectionVersionRepositoryPort,
  SearchPort,
  TenantContextPort,
} from '@brisk/ports';
import { PREVIEW_TOKEN_TTL_MS } from '../preview-token-ttl.constant';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { TENANT_CONTEXT } from '../auth/auth.tokens';
import { ZodValidationPipe } from '../zod-validation.pipe';
import {
  type CreateBody,
  createBodySchema,
  type ExposedFieldsBody,
  exposedFieldsBodySchema,
  type ListQuery,
  listQuerySchema,
  type RenameBody,
  renameBodySchema,
  type RollbackBody,
  rollbackBodySchema,
  type SaveDraftBody,
  saveDraftBodySchema,
} from './reusable-sections.schemas';
import {
  PAGE_TRANSLATION_REPOSITORY,
  PREVIEW_TOKEN_PORT,
  REUSABLE_SECTION_REPOSITORY,
  REUSABLE_SECTION_VERSION_REPOSITORY,
  SEARCH_PORT,
} from './reusable-sections.tokens';

@Controller('reusable-sections')
@UseGuards(SessionAuthGuard)
export class ReusableSectionsController {
  constructor(
    @Inject(REUSABLE_SECTION_REPOSITORY)
    private readonly reusableSectionRepository: ReusableSectionRepositoryPort,
    @Inject(REUSABLE_SECTION_VERSION_REPOSITORY)
    private readonly reusableSectionVersionRepository: ReusableSectionVersionRepositoryPort,
    @Inject(PAGE_TRANSLATION_REPOSITORY)
    private readonly pageTranslationRepository: PageTranslationRepositoryPort,
    @Inject(SEARCH_PORT) private readonly searchPort: SearchPort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
    @Inject(PREVIEW_TOKEN_PORT)
    private readonly previewTokenPort: PreviewTokenPort,
  ) {}

  private get deps() {
    return {
      reusableSectionRepository: this.reusableSectionRepository,
      reusableSectionVersionRepository: this.reusableSectionVersionRepository,
    };
  }

  private get tenantId(): string {
    return this.tenantContext.getCurrentTenantId();
  }

  @Get()
  async list(@Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery) {
    const sections = await listReusableSections(
      this.deps,
      this.tenantId,
      query.siteId,
    );
    return sections.map((section) => section.toProps());
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createBodySchema)) body: CreateBody,
  ) {
    const section = await createReusableSection(this.deps, {
      tenantId: this.tenantId,
      siteId: body.siteId,
      name: body.name,
      kind: body.kind,
      content: body.content,
      actorUserId: null,
    });
    return section.toProps();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const section = await getReusableSection(this.deps, this.tenantId, id);
    return section.toProps();
  }

  @Post(':id/preview-token')
  async createPreviewToken(@Param('id') id: string) {
    const section = await this.reusableSectionRepository.findById(
      this.tenantId,
      id,
    );
    if (!section) {
      throw new NotFoundException(`Reusable section not found: ${id}`);
    }
    const { token, expiresAt } = await this.previewTokenPort.createToken(
      this.tenantId,
      'section',
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
    const section = await saveReusableSectionDraft(this.deps, {
      tenantId: this.tenantId,
      id,
      content: body.content,
      actorUserId: null,
    });
    return section.toProps();
  }

  @Patch(':id/name')
  async rename(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(renameBodySchema)) body: RenameBody,
  ) {
    const section = await renameReusableSection(this.deps, {
      tenantId: this.tenantId,
      id,
      name: body.name,
    });
    return section.toProps();
  }

  @Patch(':id/exposed-fields')
  async setExposedFields(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(exposedFieldsBodySchema))
    body: ExposedFieldsBody,
  ) {
    const section = await setReusableSectionExposedFields(this.deps, {
      tenantId: this.tenantId,
      id,
      exposedFields: body.exposedFields,
    });
    return section.toProps();
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string) {
    const section = await publishReusableSection(
      {
        reusableSectionRepository: this.reusableSectionRepository,
        pageTranslationRepository: this.pageTranslationRepository,
        searchPort: this.searchPort,
      },
      { tenantId: this.tenantId, id },
    );
    return section.toProps();
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await deleteReusableSection(this.deps, this.tenantId, id);
    return { deleted: true };
  }

  @Get(':id/versions')
  async listVersions(@Param('id') id: string) {
    return listReusableSectionVersions(this.deps, this.tenantId, id);
  }

  @Post(':id/rollback')
  async rollback(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rollbackBodySchema)) body: RollbackBody,
  ) {
    const section = await rollbackReusableSectionToVersion(this.deps, {
      tenantId: this.tenantId,
      id,
      versionId: body.versionId,
      actorUserId: null,
    });
    return section.toProps();
  }
}
