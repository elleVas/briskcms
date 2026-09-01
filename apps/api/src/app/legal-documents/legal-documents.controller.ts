import {
  Body,
  Controller,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  generateLegalDocuments,
  LEGAL_DOCUMENT_TEMPLATES,
  resolveTemplateLocale,
} from '@brisk/application';
import type {
  PageGroupRepositoryPort,
  PageTranslationRepositoryPort,
  SiteRepositoryPort,
  TenantContextPort,
} from '@brisk/ports';
import { TENANT_CONTEXT } from '../auth/auth.tokens';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ZodValidationPipe } from '../zod-validation.pipe';
import {
  PAGE_GROUP_REPOSITORY,
  PAGE_TRANSLATION_REPOSITORY,
} from '../pages/page-groups.tokens';
import { SITE_REPOSITORY } from '../sites/sites.tokens';
import {
  generateLegalDocumentsBodySchema,
  generateLegalDocumentsResponseSchema,
  previewLegalDocumentsResponseSchema,
  type GenerateLegalDocumentsBody,
} from './legal-documents.schemas';

/**
 * Generates draft Privacy Policy / Cookie Policy / Terms & Conditions
 * pages from a deterministic template (docs/adr/0040) — no role gate
 * beyond being logged in, since it only ever creates drafts (never
 * publishes) and injects no raw script, unlike theme-settings.
 */
@Controller('sites/:siteId/legal-documents')
@UseGuards(SessionAuthGuard)
export class LegalDocumentsController {
  constructor(
    @Inject(SITE_REPOSITORY)
    private readonly siteRepository: SiteRepositoryPort,
    @Inject(PAGE_GROUP_REPOSITORY)
    private readonly pageGroupRepository: PageGroupRepositoryPort,
    @Inject(PAGE_TRANSLATION_REPOSITORY)
    private readonly pageTranslationRepository: PageTranslationRepositoryPort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
  ) {}

  @Post()
  async generate(
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(generateLegalDocumentsBodySchema))
    body: GenerateLegalDocumentsBody,
  ) {
    const result = await generateLegalDocuments(
      {
        siteRepository: this.siteRepository,
        pageGroupRepository: this.pageGroupRepository,
        pageTranslationRepository: this.pageTranslationRepository,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId,
        documents: body.documents,
        locales: body.locales,
        answers: body.answers,
        createdBy: this.tenantContext.getCurrentUserId(),
      },
    );
    return generateLegalDocumentsResponseSchema.parse(result);
  }

  // No persistence — lets the wizard show real generated text in its
  // review step before the site owner commits to creating the drafts.
  @Post('preview')
  async preview(
    @Body(new ZodValidationPipe(generateLegalDocumentsBodySchema))
    body: GenerateLegalDocumentsBody,
  ) {
    const documents = body.documents.map((kind) => {
      const template = LEGAL_DOCUMENT_TEMPLATES[kind];
      const locales = Object.fromEntries(
        body.locales.map((locale) => {
          const templateLocale = resolveTemplateLocale(locale);
          const outline = template[templateLocale](body.answers);
          return [locale, outline];
        }),
      );
      return { kind, locales };
    });
    return previewLegalDocumentsResponseSchema.parse({ documents });
  }
}
