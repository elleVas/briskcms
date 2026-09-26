import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
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
import type { Taxonomy, Term } from '@brisk/domain-core';
import {
  type TaxonomyRecord,
  type TermRecord,
  taxonomyRecordSchema,
  termRecordSchema,
} from '@brisk/shared-types';
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
import { UuidParam } from '../uuid-param.decorator';

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
    return taxonomies.map((taxonomy) => this.toTaxonomyDto(taxonomy));
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
    return this.toTaxonomyDto(taxonomy);
  }

  @Get(':id')
  async get(@UuidParam('id') id: string) {
    const taxonomy = await getTaxonomy(this.deps, this.tenantId, id);
    return this.toTaxonomyDto(taxonomy);
  }

  @Patch(':id')
  async update(
    @UuidParam('id') id: string,
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
    return this.toTaxonomyDto(taxonomy);
  }

  @Delete(':id')
  async remove(@UuidParam('id') id: string) {
    await deleteTaxonomy(this.deps, this.tenantId, id);
    return { ok: true };
  }

  @Get(':id/terms')
  async listTerms(@UuidParam('id') id: string) {
    // Through the taxonomy, so a request for the terms of a dimension
    // that does not exist is a 404 rather than an empty list — an empty
    // list is an answer about a dimension, and there is none.
    await getTaxonomy(this.deps, this.tenantId, id);
    const terms = await listTerms(this.deps, this.tenantId, id);
    return terms.map((term) => this.toTermDto(term));
  }

  @Post(':id/terms')
  async createTerm(
    @UuidParam('id') id: string,
    @Body(new ZodValidationPipe(createTermBodySchema)) body: CreateTermBody,
  ) {
    const term = await createTerm(this.deps, {
      tenantId: this.tenantId,
      taxonomyId: id,
      name: body.name,
      slugs: body.slugs,
      parentId: body.parentId ?? null,
    });
    return this.toTermDto(term);
  }

  @Get('terms/:termId')
  async getTerm(@UuidParam('termId') termId: string) {
    const term = await getTerm(this.deps, this.tenantId, termId);
    return this.toTermDto(term);
  }

  @Patch('terms/:termId')
  async updateTerm(
    @UuidParam('termId') termId: string,
    @Body(new ZodValidationPipe(updateTermBodySchema)) body: UpdateTermBody,
  ) {
    const term = await updateTerm(this.deps, {
      tenantId: this.tenantId,
      id: termId,
      name: body.name,
      description: body.description,
      seoMeta: body.seoMeta,
      noindex: body.noindex,
      slugs: body.slugs,
      ...(body.landingPageGroupId === undefined
        ? {}
        : { landingPageGroupId: body.landingPageGroupId }),
      order: body.order,
    });
    return this.toTermDto(term);
  }

  @Patch('terms/:termId/parent')
  async moveTerm(
    @UuidParam('termId') termId: string,
    @Body(new ZodValidationPipe(moveTermBodySchema)) body: MoveTermBody,
  ) {
    const term = await moveTerm(this.deps, {
      tenantId: this.tenantId,
      id: termId,
      parentId: body.parentId,
    });
    return this.toTermDto(term);
  }

  @Delete('terms/:termId')
  async removeTerm(@UuidParam('termId') termId: string) {
    await deleteTerm(this.deps, this.tenantId, termId);
    return { ok: true };
  }

  /** Whitelisted field by field, never the entity's props spread — same reasoning as every other controller here. */
  private toTaxonomyDto(taxonomy: Taxonomy): TaxonomyRecord {
    const props = taxonomy.toProps();
    return taxonomyRecordSchema.parse({
      id: props.id,
      tenantId: props.tenantId,
      siteId: props.siteId,
      prefix: props.prefix,
      name: props.name,
      hierarchical: props.hierarchical,
      order: props.order,
      createdAt: props.createdAt.toISOString(),
      updatedAt: props.updatedAt.toISOString(),
    });
  }

  private toTermDto(term: Term): TermRecord {
    const props = term.toProps();
    return termRecordSchema.parse({
      id: props.id,
      tenantId: props.tenantId,
      siteId: props.siteId,
      taxonomyId: props.taxonomyId,
      parentId: props.parentId,
      name: props.name,
      description: props.description,
      seoMeta: props.seoMeta,
      noindex: props.noindex,
      landingPageGroupId: props.landingPageGroupId,
      order: props.order,
      slugs: props.slugs,
      createdAt: props.createdAt.toISOString(),
      updatedAt: props.updatedAt.toISOString(),
    });
  }
}
