import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
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
  listPages,
  listPageTranslations,
  listPageVersions,
  publishPage,
  rollbackToVersion,
  saveDraft,
  setPageParent,
  updateSeoMeta,
} from '@brisk/application';
import {
  PageHierarchyCycleError,
  PageHierarchyLocaleMismatchError,
  PageNotFoundError,
  PageSlugAlreadyExistsError,
  PageTranslationAlreadyExistsError,
  PageVersionNotFoundError,
} from '@brisk/domain-core';
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
import {
  PAGE_REPOSITORY,
  PAGE_VERSION_REPOSITORY,
  PREVIEW_TOKEN_PORT,
  SEARCH_REPOSITORY,
  TENANT_CONTEXT,
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
    return this.handleDomainErrors(async () => {
      const page = await createPage(
        {
          pageRepository: this.pageRepository,
          pageVersionRepository: this.pageVersionRepository,
        },
        {
          ...body,
          createdBy: null,
          tenantId: this.tenantContext.getCurrentTenantId(),
        },
      );
      return page.toProps();
    });
  }

  @Patch(':id/parent')
  async setParent(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setPageParentBodySchema))
    body: SetPageParentBody,
  ) {
    return this.handleDomainErrors(async () => {
      const page = await setPageParent(
        { pageRepository: this.pageRepository },
        {
          tenantId: this.tenantContext.getCurrentTenantId(),
          pageId: id,
          parentId: body.parentId,
        },
      );
      return page.toProps();
    });
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
    return {
      items: result.items.map((page) => page.toProps()),
      total: result.total,
    };
  }

  @Get('by-slug')
  async findBySlug(
    @Query('siteId') siteId: string,
    @Query('locale') locale: string,
    @Query('slug') slug: string,
  ) {
    const page = await this.pageRepository.findBySlug(
      this.tenantContext.getCurrentTenantId(),
      siteId,
      locale,
      slug,
    );
    if (!page) {
      throw new NotFoundException(
        `Page not found: ${siteId}/${locale}/${slug}`,
      );
    }
    return page.toProps();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const page = await this.pageRepository.findById(
      this.tenantContext.getCurrentTenantId(),
      id,
    );
    if (!page) {
      throw new NotFoundException(`Page not found: ${id}`);
    }
    return page.toProps();
  }

  // Ogni ruolo che può salvare una bozza deve poter anche previewarla —
  // stesso gate di saveDraft sotto, non ristretto come publish.
  @Post(':id/preview-token')
  async createPreviewToken(@Param('id') id: string) {
    const page = await this.pageRepository.findById(
      this.tenantContext.getCurrentTenantId(),
      id,
    );
    if (!page) {
      throw new NotFoundException(`Page not found: ${id}`);
    }
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
    return this.handleDomainErrors(async () => {
      const page = await saveDraft(
        {
          pageRepository: this.pageRepository,
          pageVersionRepository: this.pageVersionRepository,
        },
        {
          tenantId: this.tenantContext.getCurrentTenantId(),
          pageId: id,
          content: body.content,
          actorUserId: null,
        },
      );
      return page.toProps();
    });
  }

  @Patch(':id/seo')
  async updateSeo(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSeoMetaBodySchema))
    body: UpdateSeoMetaBody,
  ) {
    return this.handleDomainErrors(async () => {
      const page = await updateSeoMeta(
        { pageRepository: this.pageRepository },
        {
          tenantId: this.tenantContext.getCurrentTenantId(),
          pageId: id,
          seoMeta: body.seoMeta,
        },
      );
      return page.toProps();
    });
  }

  // Fase 5c: only admin/publisher can publish — draft/save stays open to
  // every logged-in role (editor included), only this one action is
  // gated.
  @Post(':id/publish')
  @UseGuards(RolesGuard)
  @Roles('admin', 'publisher')
  async publish(@Param('id') id: string) {
    return this.handleDomainErrors(async () => {
      const page = await publishPage(
        { pageRepository: this.pageRepository, searchPort: this.searchPort },
        { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
      );
      return page.toProps();
    });
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
    return this.handleDomainErrors(async () => {
      const translations = await listPageTranslations(
        { pageRepository: this.pageRepository },
        { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
      );
      return translations.map((page) => page.toProps());
    });
  }

  @Post(':id/translations')
  async createTranslation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createTranslationBodySchema))
    body: CreateTranslationBody,
  ) {
    return this.handleDomainErrors(async () => {
      const translation = await createPageTranslation(
        {
          pageRepository: this.pageRepository,
          pageVersionRepository: this.pageVersionRepository,
        },
        {
          tenantId: this.tenantContext.getCurrentTenantId(),
          sourcePageId: id,
          locale: body.locale,
          slug: body.slug,
          createdBy: null,
        },
      );
      return translation.toProps();
    });
  }

  @Post(':id/duplicate')
  async duplicate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(duplicatePageBodySchema))
    body: DuplicatePageBody,
  ) {
    return this.handleDomainErrors(async () => {
      const duplicate = await duplicatePage(
        {
          pageRepository: this.pageRepository,
          pageVersionRepository: this.pageVersionRepository,
        },
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
    });
  }

  @Post(':id/rollback')
  async rollback(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rollbackBodySchema)) body: RollbackBody,
  ) {
    return this.handleDomainErrors(async () => {
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
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    return this.handleDomainErrors(() =>
      deletePage(
        { pageRepository: this.pageRepository },
        { tenantId: this.tenantContext.getCurrentTenantId(), pageId: id },
      ),
    );
  }

  private async handleDomainErrors<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (
        error instanceof PageNotFoundError ||
        error instanceof PageVersionNotFoundError
      ) {
        throw new NotFoundException(error.message);
      }
      if (
        error instanceof PageSlugAlreadyExistsError ||
        error instanceof PageTranslationAlreadyExistsError
      ) {
        throw new ConflictException(error.message);
      }
      if (
        error instanceof PageHierarchyCycleError ||
        error instanceof PageHierarchyLocaleMismatchError
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
