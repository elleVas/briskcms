import {
  availableThemesResponseSchema,
  siteRecordSchema,
  type AvailableTheme,
  type BlockStyleOverride,
  type CookieBannerSettings,
  type LocaleSettings,
  type OpeningHoursDay,
  type SiteRecord,
  type ThemeSettings,
} from '@brisk/shared-types';
import { request } from './http-client';

async function requestSite(
  path: string,
  init?: RequestInit,
): Promise<SiteRecord> {
  return siteRecordSchema.parse(await request(path, init));
}

/**
 * No id: which site this deployment edits is the API's to resolve, not the
 * browser's to know. It used to come from `VITE_DEFAULT_SITE_ID`, baked
 * into this bundle at image build time — which could never match a site the
 * first-run wizard creates afterwards.
 */
export function getCurrentSite(): Promise<SiteRecord> {
  return requestSite('/sites/current');
}

export interface UpdateBusinessInfoInput {
  businessAddress: string | null;
  businessPhone: string | null;
  businessType: string | null;
  openingHours: OpeningHoursDay[] | null;
}

export function updateBusinessInfo(
  id: string,
  input: UpdateBusinessInfoInput,
): Promise<SiteRecord> {
  return requestSite(`/sites/${id}/business-info`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export interface UpdateGeneralSettingsInput {
  name: string;
  domain: string | null;
}

export function updateGeneralSettings(
  id: string,
  input: UpdateGeneralSettingsInput,
): Promise<SiteRecord> {
  return requestSite(`/sites/${id}/general-settings`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export interface UpdateSeoSettingsInput {
  searchEngineIndexingEnabled: boolean;
}

export function updateSeoSettings(
  id: string,
  input: UpdateSeoSettingsInput,
): Promise<SiteRecord> {
  return requestSite(`/sites/${id}/seo-settings`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export interface UpdateFormSubmissionRetentionInput {
  formSubmissionRetentionDays: number | null;
}

export function updateFormSubmissionRetention(
  id: string,
  input: UpdateFormSubmissionRetentionInput,
): Promise<SiteRecord> {
  return requestSite(`/sites/${id}/form-submission-retention`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateLocaleSettings(
  id: string,
  input: LocaleSettings,
): Promise<SiteRecord> {
  return requestSite(`/sites/${id}/locale-settings`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateThemeSettings(
  id: string,
  input: ThemeSettings,
): Promise<SiteRecord> {
  return requestSite(`/sites/${id}/theme-settings`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateCookieBannerSettings(
  id: string,
  input: CookieBannerSettings,
): Promise<SiteRecord> {
  return requestSite(`/sites/${id}/cookie-banner-settings`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export interface UpdateThemePackageInput {
  themeName: string;
}

export function updateThemePackage(
  id: string,
  input: UpdateThemePackageInput,
): Promise<SiteRecord> {
  return requestSite(`/sites/${id}/theme-package`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function listAvailableThemes(): Promise<AvailableTheme[]> {
  return availableThemesResponseSchema.parse(
    await request('/sites/themes/available'),
  );
}

export function updateThemeTokens(
  id: string,
  blockType: string,
  style: BlockStyleOverride,
): Promise<SiteRecord> {
  return requestSite(`/sites/${id}/theme-tokens`, {
    method: 'PATCH',
    body: JSON.stringify({ blockType, style }),
  });
}
