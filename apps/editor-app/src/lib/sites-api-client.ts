import type {
  LocaleSettings,
  OpeningHoursDay,
  ThemeSettings,
  ThemeTokens,
} from '@brisk/shared-types';
import { request } from './http-client.js';

export interface SiteDto {
  id: string;
  tenantId: string;
  name: string;
  domain: string | null;
  defaultLocale: string;
  enabledLocales: string[];
  untranslatedPageFallback: LocaleSettings['untranslatedPageFallback'];
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
  themeOverridesEnabled: boolean;
  themeTokens: ThemeTokens | null;
  createdAt: string;
}

export function getSite(id: string): Promise<SiteDto> {
  return request(`/sites/${id}`);
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
): Promise<SiteDto> {
  return request(`/sites/${id}/business-info`, {
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
): Promise<SiteDto> {
  return request(`/sites/${id}/general-settings`, {
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
): Promise<SiteDto> {
  return request(`/sites/${id}/seo-settings`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateLocaleSettings(
  id: string,
  input: LocaleSettings,
): Promise<SiteDto> {
  return request(`/sites/${id}/locale-settings`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateThemeSettings(
  id: string,
  input: ThemeSettings,
): Promise<SiteDto> {
  return request(`/sites/${id}/theme-settings`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateThemeTokens(
  id: string,
  input: Partial<ThemeTokens>,
): Promise<SiteDto> {
  return request(`/sites/${id}/theme-tokens`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
