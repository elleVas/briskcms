import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createTaxonomy,
  createTerm,
  deleteTaxonomy,
  deleteTerm,
  getTaxonomy,
  getTerm,
  listTaxonomies,
  listTerms,
  moveTerm,
  updateTaxonomy,
  updateTerm,
} from '@brisk/application';
import type {
  PageTranslationRepositoryPort,
  SiteRepositoryPort,
  TaxonomyRepositoryPort,
  TenantContextPort,
} from '@brisk/ports';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { TENANT_CONTEXT } from '../auth/auth.tokens';
import { ZodValidationPipe } from '../zod-validation.pipe';
import {
  createTaxonomyBodySchema,
  createTermBodySchema,
  listQuerySchema,
  moveTermBodySchema,
  updateTaxonomyBodySchema,
  updateTermBodySchema,
  type CreateTaxonomyBody,
  type CreateTermBody,
  type ListQuery,
  type MoveTermBody,
  type UpdateTaxonomyBody,
  type UpdateTermBody,
} from './taxonomies.schemas';
import {
  PAGE_TRANSLATION_REPOSITORY,
  SITE_REPOSITORY,
  TAXONOMY_REPOSITORY,
} from './taxonomies.tokens';

/**
 * Dimensions and their terms (docs/adr/0064). Terms are nested under
 * their taxonomy in the URL because they have no meaning without one —
 * a term id alone would still work, and would hide that the dimension is
 * what decides the address.
 */
@Controller('taxonomies')
@UseGuards(SessionAuthGuard)
export class TaxonomiesController {
  constructor(
    @Inject(TAXONOMY_REPOSITORY)
    private readonly taxonomyRepository: TaxonomyRepositoryPort,
    @Inject(PAGE_TRANSLATION_REPOSITORY)
    private readonly pageTranslationRepository: PageTranslationRepositoryPort,
    @Inject(SITE_REPOSITORY)
    private readonly siteRepository: SiteRepositoryPort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
  ) {}

  private get deps() {
    return {
      taxonomyRepository: this.taxonomyRepository,
      pageTranslationRepository: this.pageTranslationRepository,
      siteRepository: this.siteRepository,
    };
  }

  private get tenantId(): string {
    return this.tenantContext.getCurrentTenantId();
  }

  @Get()
  async list(@Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery) {
    const taxonomies = await listTaxonomies(
      this.deps,
      this.tenantId,
      query.siteId,
    );
    return taxonomies.map((taxonomy) => taxonomy.toProps());
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createTaxonomyBodySchema))
    body: CreateTaxonomyBody,
  ) {
    const taxonomy = await createTaxonomy(this.deps, {
      tenantId: this.tenantId,
      siteId: body.siteId,
      name: body.name,
      // `undefined` and `null` mean different things here — see the
      // schema — so the property is only passed when the client sent it.
      ...(body.prefix === undefined ? {} : { prefix: body.prefix }),
      hierarchical: body.hierarchical,
    });
    return taxonomy.toProps();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const taxonomy = await getTaxonomy(this.deps, this.tenantId, id);
    return taxonomy.toProps();
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTaxonomyBodySchema))
    body: UpdateTaxonomyBody,
  ) {
    const taxonomy = await updateTaxonomy(this.deps, {
      tenantId: this.tenantId,
      id,
      name: body.name,
      ...(body.prefix === undefined ? {} : { prefix: body.prefix }),
      hierarchical: body.hierarchical,
      order: body.order,
    });
    return taxonomy.toProps();
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await deleteTaxonomy(this.deps, this.tenantId, id);
    return { ok: true };
  }

  @Get(':id/terms')
  async listTerms(@Param('id') id: string) {
    // Through the taxonomy, so a request for the terms of a dimension
    // that does not exist is a 404 rather than an empty list — an empty
    // list is an answer about a dimension, and there is none.
    await getTaxonomy(this.deps, this.tenantId, id);
    const terms = await listTerms(this.deps, this.tenantId, id);
    return terms.map((term) => term.toProps());
  }

  @Post(':id/terms')
  async createTerm(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createTermBodySchema)) body: CreateTermBody,
  ) {
    const term = await createTerm(this.deps, {
      tenantId: this.tenantId,
      taxonomyId: id,
      name: body.name,
      slugs: body.slugs,
      parentId: body.parentId ?? null,
    });
    return term.toProps();
  }

  @Get('terms/:termId')
  async getTerm(@Param('termId') termId: string) {
    const term = await getTerm(this.deps, this.tenantId, termId);
    return term.toProps();
  }

  @Patch('terms/:termId')
  async updateTerm(
    @Param('termId') termId: string,
    @Body(new ZodValidationPipe(updateTermBodySchema)) body: UpdateTermBody,
  ) {
    const term = await updateTerm(this.deps, {
      tenantId: this.tenantId,
      id: termId,
      name: body.name,
      description: body.description,
      seoMeta: body.seoMeta,
      slugs: body.slugs,
      ...(body.landingPageGroupId === undefined
        ? {}
        : { landingPageGroupId: body.landingPageGroupId }),
      order: body.order,
    });
    return term.toProps();
  }

  @Patch('terms/:termId/parent')
  async moveTerm(
    @Param('termId') termId: string,
    @Body(new ZodValidationPipe(moveTermBodySchema)) body: MoveTermBody,
  ) {
    const term = await moveTerm(this.deps, {
      tenantId: this.tenantId,
      id: termId,
      parentId: body.parentId,
    });
    return term.toProps();
  }

  @Delete('terms/:termId')
  async removeTerm(@Param('termId') termId: string) {
    await deleteTerm(this.deps, this.tenantId, termId);
    return { ok: true };
  }
}
