import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
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
  listReusableSectionsWithUsage,
  publishReusableSection,
  renameReusableSection,
  rollbackReusableSectionToVersion,
  saveReusableSectionDraft,
  setReusableSectionExposedFields,
} from '@brisk/application';
import {
  type ReusableSectionListItem,
  type ReusableSectionVersionRecord,
  reusableSectionListItemSchema,
} from '@brisk/shared-types';
import { ReusableSectionRecords } from './reusable-section-records';
import type {
  PageGroupRepositoryPort,
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
  PAGE_GROUP_REPOSITORY,
  PAGE_TRANSLATION_REPOSITORY,
  PREVIEW_TOKEN_PORT,
  REUSABLE_SECTION_REPOSITORY,
  REUSABLE_SECTION_VERSION_REPOSITORY,
  SEARCH_PORT,
} from './reusable-sections.tokens';
import { UuidParam } from '../uuid-param.decorator';

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
    @Inject(PAGE_GROUP_REPOSITORY)
    private readonly pageGroupRepository: PageGroupRepositoryPort,
    @Inject(SEARCH_PORT) private readonly searchPort: SearchPort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
    @Inject(PREVIEW_TOKEN_PORT)
    private readonly previewTokenPort: PreviewTokenPort,
    private readonly records: ReusableSectionRecords,
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
  async list(
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery,
  ): Promise<ReusableSectionListItem[]> {
    const sections = await listReusableSectionsWithUsage(
      { ...this.deps, pageGroupRepository: this.pageGroupRepository },
      this.tenantId,
      query.siteId,
    );
    // The count travels with the row rather than as a second endpoint: it
    // is one number the list always shows, and a separate call would mean
    // the name and the count could disagree on screen.
    return sections.map(({ section, usedOnPages, usedInTemplates }) =>
      reusableSectionListItemSchema.parse({
        ...this.records.toRecord(section),
        usedOnPages,
        usedInTemplates,
      }),
    );
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
    return this.records.toRecord(section);
  }

  @Get(':id')
  async findById(@UuidParam('id') id: string) {
    const section = await getReusableSection(this.deps, this.tenantId, id);
    return this.records.toRecord(section);
  }

  @Post(':id/preview-token')
  async createPreviewToken(@UuidParam('id') id: string) {
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
    @UuidParam('id') id: string,
    @Body(new ZodValidationPipe(saveDraftBodySchema)) body: SaveDraftBody,
  ) {
    const section = await saveReusableSectionDraft(this.deps, {
      tenantId: this.tenantId,
      id,
      content: body.content,
      actorUserId: null,
    });
    return this.records.toRecord(section);
  }

  @Patch(':id/name')
  async rename(
    @UuidParam('id') id: string,
    @Body(new ZodValidationPipe(renameBodySchema)) body: RenameBody,
  ) {
    const section = await renameReusableSection(this.deps, {
      tenantId: this.tenantId,
      id,
      name: body.name,
    });
    return this.records.toRecord(section);
  }

  @Patch(':id/exposed-fields')
  async setExposedFields(
    @UuidParam('id') id: string,
    @Body(new ZodValidationPipe(exposedFieldsBodySchema))
    body: ExposedFieldsBody,
  ) {
    const section = await setReusableSectionExposedFields(this.deps, {
      tenantId: this.tenantId,
      id,
      exposedFields: body.exposedFields,
    });
    return this.records.toRecord(section);
  }

  @Post(':id/publish')
  async publish(@UuidParam('id') id: string) {
    const section = await publishReusableSection(
      {
        reusableSectionRepository: this.reusableSectionRepository,
        pageTranslationRepository: this.pageTranslationRepository,
        searchPort: this.searchPort,
      },
      { tenantId: this.tenantId, id },
    );
    return this.records.toRecord(section);
  }

  @Delete(':id')
  async remove(@UuidParam('id') id: string) {
    await deleteReusableSection(this.deps, this.tenantId, id);
    return { deleted: true };
  }

  @Get(':id/versions')
  async listVersions(
    @UuidParam('id') id: string,
  ): Promise<ReusableSectionVersionRecord[]> {
    const versions = await listReusableSectionVersions(
      this.deps,
      this.tenantId,
      id,
    );
    return versions.map((version) => this.records.toVersionRecord(version));
  }

  @Post(':id/rollback')
  async rollback(
    @UuidParam('id') id: string,
    @Body(new ZodValidationPipe(rollbackBodySchema)) body: RollbackBody,
  ) {
    const section = await rollbackReusableSectionToVersion(this.deps, {
      tenantId: this.tenantId,
      id,
      versionId: body.versionId,
      actorUserId: null,
    });
    return this.records.toRecord(section);
  }
}
