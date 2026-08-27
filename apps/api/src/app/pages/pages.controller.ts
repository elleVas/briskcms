import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createPage,
  createPageTranslation,
  deletePage,
  duplicatePage,
  getPageById,
  getPageBySlug,
  listPages,
  listPageTranslations,
  listPageVersions,
  publishPage,
  rollbackToVersion,
  saveDraft,
  setPageParent,
  updateSeoMeta,
} from '@brisk/application';
import type {
  PageRepositoryPort,
  PageVersionRepositoryPort,
  PreviewTokenPort,
  SearchPort,
  TenantContextPort,
} from '@brisk/ports';
import { PREVIEW_TOKEN_TTL_MS } from '../preview-token-ttl.constant.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { TENANT_CONTEXT } from '../auth/auth.tokens.js';
import {
  PAGE_REPOSITORY,
  PAGE_VERSION_REPOSITORY,
  PREVIEW_TOKEN_PORT,
  SEARCH_REPOSITORY,
} from './pages.tokens.js';
import {
  type CreatePageBody,
  createPageBodySchema,
  type CreateTranslationBody,
  createTranslationBodySchema,
  type DuplicatePageBody,
  duplicatePageBodySchema,
  type ListPagesQuery,
  listPagesQuerySchema,
  type RollbackBody,
  rollbackBodySchema,
  type SaveDraftBody,
  saveDraftBodySchema,
  type SetPageParentBody,
  setPageParentBodySchema,
  type UpdateSeoMetaBody,
  updateSeoMetaBodySchema,
} from './pages.schemas.js';

@Controller('pages')
@UseGuards(SessionAuthGuard)
export class PagesController {
  constructor(
    @Inject(PAGE_REPOSITORY)
    private readonly pageRepository: PageRepositoryPort,
    @Inject(PAGE_VERSION_REPOSITORY)
    private readonly pageVersionRepository: PageVersionRepositoryPort,
    @Inject(SEARCH_REPOSITORY)
    private readonly searchPort: SearchPort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
    @Inject(PREVIEW_TOKEN_PORT)
    private readonly previewTokenPort: PreviewTokenPort,
  ) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createPageBodySchema)) body: CreatePageBody,
  ) {
    const page = await createPage(
      { pageRepository: this.pageRepository },
      {
        ...body,
        createdBy: null,
        tenantId: this.tenantContext.getCurrentTenantId(),
      },
    );
    return page.toProps();
  }

  @Patch(':id/parent')
  async setParent(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setPageParentBodySchema))
    body: SetPageParentBody,
  ) {
    const page = await setPageParent(
      { pageRepository: this.pageRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageId: id,
        parentId: body.parentId,
      },
    );
    return page.toProps();
  }

  @Get()
  async list(
    @Query(new ZodValidationPipe(listPagesQuerySchema)) query: ListPagesQuery,
  ) {
    const result = await listPages(
      { pageRepository: this.pageRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: query.siteId,
        page: query.page,
        pageSize: query.pageSize,
      },
    );
    return result;
  }

  @Get('by-slug')
  async findBySlug(
    @Query('siteId') siteId: string,
    @Query('locale') locale: string,
    @Query('slug') slug: string,
  ) {
    const page = await getPageBySlug(
      { pageRepository: this.pageRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId,
        locale,
        slug,
      },
    );
    return page.toProps();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const page = await getPageById(
      { pageRepository: this.pageRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
    );
    return page.toProps();
  }

  // Ogni ruolo che può salvare una bozza deve poter anche previewarla —
  // stesso gate di saveDraft sotto, non ristretto come publish.
  @Post(':id/preview-token')
  async createPreviewToken(@Param('id') id: string) {
    await getPageById(
      { pageRepository: this.pageRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
    );
    const { token, expiresAt } = await this.previewTokenPort.createToken(
      this.tenantContext.getCurrentTenantId(),
      'page',
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
    const page = await saveDraft(
      { pageRepository: this.pageRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageId: id,
        content: body.content,
        actorUserId: null,
      },
    );
    return page.toProps();
  }

  @Patch(':id/seo')
  async updateSeo(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSeoMetaBodySchema))
    body: UpdateSeoMetaBody,
  ) {
    const page = await updateSeoMeta(
      { pageRepository: this.pageRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageId: id,
        seoMeta: body.seoMeta,
      },
    );
    return page.toProps();
  }

  // Fase 5c: only admin/publisher can publish — draft/save stays open to
  // every logged-in role (editor included), only this one action is
  // gated.
  @Post(':id/publish')
  @UseGuards(RolesGuard)
  @Roles('admin', 'publisher')
  async publish(@Param('id') id: string) {
    const page = await publishPage(
      { pageRepository: this.pageRepository, searchPort: this.searchPort },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
    );
    return page.toProps();
  }

  @Get(':id/versions')
  async listVersions(@Param('id') id: string) {
    const versions = await listPageVersions(
      { pageVersionRepository: this.pageVersionRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
    );
    return versions;
  }

  @Get(':id/translations')
  async listTranslations(@Param('id') id: string) {
    const translations = await listPageTranslations(
      { pageRepository: this.pageRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
    );
    return translations.map((page) => page.toProps());
  }

  @Post(':id/translations')
  async createTranslation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createTranslationBodySchema))
    body: CreateTranslationBody,
  ) {
    const translation = await createPageTranslation(
      { pageRepository: this.pageRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        sourcePageId: id,
        locale: body.locale,
        slug: body.slug,
        createdBy: null,
      },
    );
    return translation.toProps();
  }

  @Post(':id/duplicate')
  async duplicate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(duplicatePageBodySchema))
    body: DuplicatePageBody,
  ) {
    const duplicate = await duplicatePage(
      { pageRepository: this.pageRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        sourcePageId: id,
        slug: body.slug,
        title: body.title,
        description: body.description,
        createdBy: null,
      },
    );
    return duplicate.toProps();
  }

  @Post(':id/rollback')
  async rollback(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rollbackBodySchema)) body: RollbackBody,
  ) {
    const page = await rollbackToVersion(
      {
        pageRepository: this.pageRepository,
        pageVersionRepository: this.pageVersionRepository,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        pageId: id,
        versionId: body.versionId,
        actorUserId: null,
      },
    );
    return page.toProps();
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await deletePage(
      { pageRepository: this.pageRepository },
      { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
    );
  }
}
