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
  updateSiteCookieBannerSettings,
  updateSiteFormSubmissionRetention,
  updateSiteGeneralSettings,
  updateSiteLocaleSettings,
  updateSiteSeoSettings,
  updateSiteThemePackage,
  updateSiteThemeSettings,
  updateSiteThemeTokens,
} from '@brisk/application';
import { SiteNotFoundError, type Site } from '@brisk/domain-core';
import type {
  SiteRepositoryPort,
  SiteThemeBlockStylesPort,
  TenantContextPort,
  ThemeCatalogPort,
} from '@brisk/ports';
import {
  availableThemesResponseSchema,
  siteRecordSchema,
  type SiteRecord,
} from '@brisk/shared-types';
import {
  DEPLOYMENT_SITE_RESOLVER,
  DeploymentSiteResolver,
} from './deployment-site.resolver';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ZodValidationPipe } from '../zod-validation.pipe';
import {
  type UpdateBusinessInfoBody,
  updateBusinessInfoBodySchema,
  type UpdateGeneralSettingsBody,
  updateGeneralSettingsBodySchema,
  type UpdateLocaleSettingsBody,
  updateLocaleSettingsBodySchema,
  type UpdateSeoSettingsBody,
  updateSeoSettingsBodySchema,
  type UpdateFormSubmissionRetentionBody,
  updateFormSubmissionRetentionBodySchema,
  type UpdateThemeSettingsBody,
  updateThemeSettingsBodySchema,
  type UpdateThemeTokensBody,
  updateThemeTokensBodySchema,
  type UpdateCookieBannerSettingsBody,
  updateCookieBannerSettingsBodySchema,
  type UpdateThemePackageBody,
  updateThemePackageBodySchema,
} from './sites.schemas';
import { TENANT_CONTEXT } from '../auth/auth.tokens';
import {
  SITE_REPOSITORY,
  SITE_THEME_BLOCK_STYLES_REPOSITORY,
  THEME_CATALOG,
} from './sites.tokens';

@Controller('sites')
@UseGuards(SessionAuthGuard)
export class SitesController {
  constructor(
    @Inject(SITE_REPOSITORY)
    private readonly siteRepository: SiteRepositoryPort,
    @Inject(SITE_THEME_BLOCK_STYLES_REPOSITORY)
    private readonly siteThemeBlockStylesRepository: SiteThemeBlockStylesPort,
    @Inject(THEME_CATALOG)
    private readonly themeCatalog: ThemeCatalogPort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
    @Inject(DEPLOYMENT_SITE_RESOLVER)
    private readonly deploymentSiteResolver: DeploymentSiteResolver,
  ) {}

  @Get('themes/available')
  async listAvailableThemes() {
    return availableThemesResponseSchema.parse(
      await this.themeCatalog.listAvailableThemes(),
    );
  }

  /**
   * The site this deployment edits — how apps/editor-app learns its id at
   * all, now that it no longer carries one baked into its bundle.
   *
   * Declared above `@Get(':id')` on purpose: Nest matches routes in
   * declaration order, so the parameterised one would otherwise swallow
   * "current" and look for a site with that literal id. Same reason
   * `themes/available` sits where it does.
   */
  @Get('current')
  async findCurrent() {
    return this.toDto(
      await this.deploymentSiteResolver.require(
        this.tenantContext.getCurrentTenantId(),
      ),
    );
  }

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
    const site = await updateSiteBusinessInfo(
      { siteRepository: this.siteRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: id,
        ...body,
      },
    );
    return this.toDto(site);
  }

  @Patch(':id/general-settings')
  async updateGeneralSettings(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateGeneralSettingsBodySchema))
    body: UpdateGeneralSettingsBody,
  ) {
    const site = await updateSiteGeneralSettings(
      { siteRepository: this.siteRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: id,
        ...body,
      },
    );
    return this.toDto(site);
  }

  @Patch(':id/seo-settings')
  async updateSeoSettings(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSeoSettingsBodySchema))
    body: UpdateSeoSettingsBody,
  ) {
    const site = await updateSiteSeoSettings(
      { siteRepository: this.siteRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: id,
        ...body,
      },
    );
    return this.toDto(site);
  }

  @Patch(':id/form-submission-retention')
  async updateFormSubmissionRetention(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateFormSubmissionRetentionBodySchema))
    body: UpdateFormSubmissionRetentionBody,
  ) {
    const site = await updateSiteFormSubmissionRetention(
      { siteRepository: this.siteRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: id,
        ...body,
      },
    );
    return this.toDto(site);
  }

  @Patch(':id/locale-settings')
  async updateLocaleSettings(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLocaleSettingsBodySchema))
    body: UpdateLocaleSettingsBody,
  ) {
    const site = await updateSiteLocaleSettings(
      { siteRepository: this.siteRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: id,
        ...body,
      },
    );
    return this.toDto(site);
  }

  // customCss/headScript/bodyScript below are injected verbatim into every
  // visitor's page (PageLayout.astro, ADR-0021, deliberately unsanitized —
  // meant for trusted admins only). Without this guard any authenticated
  // role, including the lowest ('editor'), could inject arbitrary script
  // served to the whole public site (security review 2026-08-25, critical).
  @Patch(':id/theme-settings')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async updateThemeSettings(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateThemeSettingsBodySchema))
    body: UpdateThemeSettingsBody,
  ) {
    const site = await updateSiteThemeSettings(
      { siteRepository: this.siteRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: id,
        ...body,
      },
    );
    return this.toDto(site);
  }

  // Tier 2 selection (docs/adr/0021/0042) — admin-gated for the same reason
  // as theme-settings above: which theme a site's visitors see is at least
  // as consequential as its style overrides.
  @Patch(':id/theme-package')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async updateThemePackage(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateThemePackageBodySchema))
    body: UpdateThemePackageBody,
  ) {
    const site = await updateSiteThemePackage(
      { siteRepository: this.siteRepository, themeCatalog: this.themeCatalog },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: id,
        ...body,
      },
    );
    return this.toDto(site);
  }

  @Patch(':id/cookie-banner-settings')
  async updateCookieBannerSettings(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCookieBannerSettingsBodySchema))
    body: UpdateCookieBannerSettingsBody,
  ) {
    const site = await updateSiteCookieBannerSettings(
      { siteRepository: this.siteRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: id,
        ...body,
      },
    );
    return this.toDto(site);
  }

  @Patch(':id/theme-tokens')
  async updateThemeTokens(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateThemeTokensBodySchema))
    body: UpdateThemeTokensBody,
  ) {
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
  }

  /**
   * Every handler returning the site does so through this one point —
   * `themeTokens` is no longer part of `Site`/`SiteProps` (it lives in
   * `site_theme_block_styles`, docs/adr/0022's schema follow-up) but the
   * HTTP response contract stays unchanged so no consumer has to be touched
   * (editor-app overwrites its whole site cache with ANY of these mutation
   * responses — a DTO without `themeTokens` would make it disappear from
   * the cache until the next GET).
   *
   * Security review 2026-08-24, second backend pass: this used to do
   * `{ ...site.toProps(), themeTokens }` — a name that looked like a
   * whitelist without being one, exposing every field of Site unfiltered.
   * There is no sensitive field on Site today, but without an explicit
   * whitelist a future one would be exposed here automatically.
   */
  private async toDto(site: Site): Promise<SiteRecord> {
    const blockStyles = await this.siteThemeBlockStylesRepository.listBySite(
      site.tenantId,
      site.id,
    );
    const props = site.toProps();
    // Validated, not just cast: siteRecordSchema is the same schema
    // apps/editor-app's sites-api-client.ts parses the response against —
    // a shape mismatch fails loudly here instead of silently reaching the
    // client as a structurally-wrong object.
    return siteRecordSchema.parse({
      id: props.id,
      tenantId: props.tenantId,
      name: props.name,
      domain: props.domain,
      themeName: props.themeName,
      defaultLocale: props.defaultLocale,
      enabledLocales: props.enabledLocales,
      untranslatedPageFallback: props.untranslatedPageFallback,
      businessAddress: props.businessAddress,
      businessPhone: props.businessPhone,
      businessType: props.businessType,
      openingHours: props.openingHours,
      searchEngineIndexingEnabled: props.searchEngineIndexingEnabled,
      formSubmissionRetentionDays: props.formSubmissionRetentionDays,
      themePrimaryColor: props.themePrimaryColor,
      themeSecondaryColor: props.themeSecondaryColor,
      themeFontFamily: props.themeFontFamily,
      themeCustomCss: props.themeCustomCss,
      themeHeadScript: props.themeHeadScript,
      themeBodyScript: props.themeBodyScript,
      themeFaviconUrl: props.themeFaviconUrl,
      themeOverridesEnabled: props.themeOverridesEnabled,
      themeAllowedTrackerDomains: props.themeAllowedTrackerDomains,
      themeTrackerScripts: props.themeTrackerScripts,
      cookieBannerSettings: props.cookieBannerSettings,
      // .toISOString(), not the raw Date: siteRecordSchema's createdAt is a
      // string (the shape the client actually parses off the wire) —
      // validating a live Date object against it would fail even though
      // JSON.stringify would have serialized it to the same string anyway.
      createdAt: props.createdAt.toISOString(),
      themeTokens: { blockStyles },
    });
  }
}
