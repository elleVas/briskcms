import type {
  OpeningHoursDay,
  ThemeSettings,
  UntranslatedPageFallback,
} from '@brisk/shared-types';

export interface SiteProps {
  id: string;
  tenantId: string;
  name: string;
  domain: string | null;
  defaultLocale: string;
  enabledLocales: string[];
  untranslatedPageFallback: UntranslatedPageFallback;
  businessAddress: string | null;
  businessPhone: string | null;
  businessType: string | null;
  openingHours: OpeningHoursDay[] | null;
  searchEngineIndexingEnabled: boolean;
  themePrimaryColor: string | null;
  themeSecondaryColor: string | null;
  themeFontFamily: string | null;
  themeCustomCss: string | null;
  themeHeadScript: string | null;
  themeBodyScript: string | null;
  themeFaviconUrl: string | null;
  createdAt: Date;
}

export interface UpdateBusinessInfoInput {
  businessAddress: string | null;
  businessPhone: string | null;
  businessType: string | null;
  openingHours: OpeningHoursDay[] | null;
}

export interface UpdateGeneralSettingsInput {
  name: string;
  domain: string | null;
}

export interface UpdateSeoSettingsInput {
  searchEngineIndexingEnabled: boolean;
}

export interface UpdateLocaleSettingsInput {
  defaultLocale: string;
  enabledLocales: string[];
  untranslatedPageFallback: UntranslatedPageFallback;
}

export type UpdateThemeSettingsInput = ThemeSettings;

export class Site {
  private constructor(private props: SiteProps) {}

  static fromProps(props: SiteProps): Site {
    return new Site({ ...props });
  }

  toProps(): SiteProps {
    return { ...this.props };
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get name(): string {
    return this.props.name;
  }

  get domain(): string | null {
    return this.props.domain;
  }

  get defaultLocale(): string {
    return this.props.defaultLocale;
  }

  get enabledLocales(): string[] {
    return this.props.enabledLocales;
  }

  /** What a visitor sees for a page not translated into their locale (Fase 5b, docs/adr/0017). */
  get untranslatedPageFallback(): UntranslatedPageFallback {
    return this.props.untranslatedPageFallback;
  }

  get businessAddress(): string | null {
    return this.props.businessAddress;
  }

  get businessPhone(): string | null {
    return this.props.businessPhone;
  }

  get businessType(): string | null {
    return this.props.businessType;
  }

  get openingHours(): OpeningHoursDay[] | null {
    return this.props.openingHours;
  }

  /**
   * Defaults to `false` (opt-in) at the DB column level for every site,
   * new or already seeded — a site mid-build shouldn't be indexed until its
   * owner deliberately decides it's ready, not the other way around.
   */
  get searchEngineIndexingEnabled(): boolean {
    return this.props.searchEngineIndexingEnabled;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * Tier 1 of docs/adr/0021's two-tier theming model — live, DB-backed,
   * layered on top of whichever filesystem theme (Tier 2) is active for
   * the deployment. Every field is nullable and independent: a site that
   * hasn't touched this panel gets every value as `null`, meaning
   * "inherit the active theme's own default", not a hardcoded fallback
   * baked in here — `null` must stay meaningful all the way to
   * rendering, not get coerced into a default value at this layer.
   */
  get themeSettings(): ThemeSettings {
    return {
      primaryColor: this.props.themePrimaryColor,
      secondaryColor: this.props.themeSecondaryColor,
      fontFamily: this.props.themeFontFamily,
      customCss: this.props.themeCustomCss,
      headScript: this.props.themeHeadScript,
      bodyScript: this.props.themeBodyScript,
      faviconUrl: this.props.themeFaviconUrl,
    };
  }

  /**
   * Used to render schema.org LocalBusiness markup (docs/adr/0014) — a
   * site with none of these set falls back to plain WebSite/WebPage, not
   * a broken LocalBusiness block.
   */
  hasBusinessInfo(): boolean {
    return (
      this.props.businessAddress !== null ||
      this.props.businessPhone !== null ||
      this.props.businessType !== null ||
      this.props.openingHours !== null
    );
  }

  updateBusinessInfo(input: UpdateBusinessInfoInput): void {
    this.props.businessAddress = input.businessAddress;
    this.props.businessPhone = input.businessPhone;
    this.props.businessType = input.businessType;
    this.props.openingHours = input.openingHours;
  }

  updateGeneralSettings(input: UpdateGeneralSettingsInput): void {
    this.props.name = input.name;
    this.props.domain = input.domain;
  }

  updateSeoSettings(input: UpdateSeoSettingsInput): void {
    this.props.searchEngineIndexingEnabled = input.searchEngineIndexingEnabled;
  }

  updateLocaleSettings(input: UpdateLocaleSettingsInput): void {
    this.props.defaultLocale = input.defaultLocale;
    this.props.enabledLocales = input.enabledLocales;
    this.props.untranslatedPageFallback = input.untranslatedPageFallback;
  }

  updateThemeSettings(input: UpdateThemeSettingsInput): void {
    this.props.themePrimaryColor = input.primaryColor;
    this.props.themeSecondaryColor = input.secondaryColor;
    this.props.themeFontFamily = input.fontFamily;
    this.props.themeCustomCss = input.customCss;
    this.props.themeHeadScript = input.headScript;
    this.props.themeBodyScript = input.bodyScript;
    this.props.themeFaviconUrl = input.faviconUrl;
  }
}
