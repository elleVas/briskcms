import type { OpeningHoursDay } from '@brisk/shared-types';
import { request } from './http-client.js';

export interface SiteDto {
  id: string;
  tenantId: string;
  name: string;
  domain: string | null;
  defaultLocale: string;
  enabledLocales: string[];
  businessAddress: string | null;
  businessPhone: string | null;
  businessType: string | null;
  openingHours: OpeningHoursDay[] | null;
  searchEngineIndexingEnabled: boolean;
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
