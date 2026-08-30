import {
  siteRecordSchema,
  type BlockStyleOverride,
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

export function getSite(id: string): Promise<SiteRecord> {
  return requestSite(`/sites/${id}`);
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
