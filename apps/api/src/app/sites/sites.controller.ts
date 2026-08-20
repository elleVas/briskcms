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
} from '@brisk/application';
import { SiteNotFoundError } from '@brisk/domain-core';
import type { SiteRepositoryPort, TenantContextPort } from '@brisk/ports';
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
} from './sites.schemas.js';
import { SITE_REPOSITORY, TENANT_CONTEXT } from './sites.tokens.js';

@Controller('sites')
@UseGuards(SessionAuthGuard)
export class SitesController {
  constructor(
    @Inject(SITE_REPOSITORY)
    private readonly siteRepository: SiteRepositoryPort,
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
    return site.toProps();
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
      return site.toProps();
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
      return site.toProps();
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
      return site.toProps();
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
      return site.toProps();
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
      return site.toProps();
    });
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
