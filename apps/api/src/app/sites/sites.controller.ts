import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  updateSiteBusinessInfo,
  updateSiteGeneralSettings,
  updateSiteLocaleSettings,
  updateSiteSeoSettings,
  updateSiteThemeSettings,
  updateSiteThemeTokens,
} from '@brisk/application';
import { SiteNotFoundError, type Site } from '@brisk/domain-core';
import type {
  SiteRepositoryPort,
  SiteThemeBlockStylesPort,
  TenantContextPort,
} from '@brisk/ports';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import {
  type UpdateBusinessInfoBody,
  updateBusinessInfoBodySchema,
  type UpdateGeneralSettingsBody,
  updateGeneralSettingsBodySchema,
  type UpdateLocaleSettingsBody,
  updateLocaleSettingsBodySchema,
  type UpdateSeoSettingsBody,
  updateSeoSettingsBodySchema,
  type UpdateThemeSettingsBody,
  updateThemeSettingsBodySchema,
  type UpdateThemeTokensBody,
  updateThemeTokensBodySchema,
} from './sites.schemas.js';
import {
  SITE_REPOSITORY,
  SITE_THEME_BLOCK_STYLES_REPOSITORY,
  TENANT_CONTEXT,
} from './sites.tokens.js';

@Controller('sites')
@UseGuards(SessionAuthGuard)
export class SitesController {
  constructor(
    @Inject(SITE_REPOSITORY)
    private readonly siteRepository: SiteRepositoryPort,
    @Inject(SITE_THEME_BLOCK_STYLES_REPOSITORY)
    private readonly siteThemeBlockStylesRepository: SiteThemeBlockStylesPort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
  ) {}

  @Get(':id')
  async findById(@Param('id') id: string) {
    const site = await this.siteRepository.findById(
      this.tenantContext.getCurrentTenantId(),
      id,
    );
    if (!site) {
      throw new NotFoundException(`Site not found: ${id}`);
    }
    return this.toDto(site);
  }

  @Patch(':id/business-info')
  async updateBusinessInfo(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBusinessInfoBodySchema))
    body: UpdateBusinessInfoBody,
  ) {
    return this.handleDomainErrors(async () => {
      const site = await updateSiteBusinessInfo(
        { siteRepository: this.siteRepository },
        {
          tenantId: this.tenantContext.getCurrentTenantId(),
          siteId: id,
          ...body,
        },
      );
      return this.toDto(site);
    });
  }

  @Patch(':id/general-settings')
  async updateGeneralSettings(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateGeneralSettingsBodySchema))
    body: UpdateGeneralSettingsBody,
  ) {
    return this.handleDomainErrors(async () => {
      const site = await updateSiteGeneralSettings(
        { siteRepository: this.siteRepository },
        {
          tenantId: this.tenantContext.getCurrentTenantId(),
          siteId: id,
          ...body,
        },
      );
      return this.toDto(site);
    });
  }

  @Patch(':id/seo-settings')
  async updateSeoSettings(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSeoSettingsBodySchema))
    body: UpdateSeoSettingsBody,
  ) {
    return this.handleDomainErrors(async () => {
      const site = await updateSiteSeoSettings(
        { siteRepository: this.siteRepository },
        {
          tenantId: this.tenantContext.getCurrentTenantId(),
          siteId: id,
          ...body,
        },
      );
      return this.toDto(site);
    });
  }

  @Patch(':id/locale-settings')
  async updateLocaleSettings(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLocaleSettingsBodySchema))
    body: UpdateLocaleSettingsBody,
  ) {
    return this.handleDomainErrors(async () => {
      const site = await updateSiteLocaleSettings(
        { siteRepository: this.siteRepository },
        {
          tenantId: this.tenantContext.getCurrentTenantId(),
          siteId: id,
          ...body,
        },
      );
      return this.toDto(site);
    });
  }

  @Patch(':id/theme-settings')
  async updateThemeSettings(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateThemeSettingsBodySchema))
    body: UpdateThemeSettingsBody,
  ) {
    return this.handleDomainErrors(async () => {
      const site = await updateSiteThemeSettings(
        { siteRepository: this.siteRepository },
        {
          tenantId: this.tenantContext.getCurrentTenantId(),
          siteId: id,
          ...body,
        },
      );
      return this.toDto(site);
    });
  }

  @Patch(':id/theme-tokens')
  async updateThemeTokens(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateThemeTokensBodySchema))
    body: UpdateThemeTokensBody,
  ) {
    return this.handleDomainErrors(async () => {
      const tenantId = this.tenantContext.getCurrentTenantId();
      await updateSiteThemeTokens(
        {
          siteRepository: this.siteRepository,
          siteThemeBlockStylesRepository: this.siteThemeBlockStylesRepository,
        },
        {
          tenantId,
          siteId: id,
          blockType: body.blockType,
          style: body.style,
        },
      );
      // Il site è già stato verificato esistente dallo use-case — un
      // secondo findById qui è per ricomporre il DTO completo, non per
      // ricontrollare l'esistenza (che getterebbe comunque un 404 identico
      // nell'improbabile finestra in cui il sito sparisse tra le due
      // chiamate).
      const site = await this.siteRepository.findById(tenantId, id);
      if (!site) {
        throw new SiteNotFoundError(id);
      }
      return this.toDto(site);
    });
  }

  /**
   * Ogni handler che restituisce il sito lo fa attraverso questo stesso
   * punto — `themeTokens` non è più parte di `Site`/`SiteProps` (vive in
   * `site_theme_block_styles`, docs/adr/0022's follow-up sullo schema) ma
   * il contratto della risposta HTTP resta invariato per non toccare
   * nessun consumer (editor-app sovrascrive per intero la propria cache
   * del sito con QUALUNQUE risposta di queste mutation — un DTO senza
   * `themeTokens` la farebbe sparire dalla cache fino al prossimo GET).
   */
  private async toDto(site: Site) {
    const blockStyles = await this.siteThemeBlockStylesRepository.listBySite(
      site.tenantId,
      site.id,
    );
    return { ...site.toProps(), themeTokens: { blockStyles } };
  }

  private async handleDomainErrors<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof SiteNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
