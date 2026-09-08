import type { Block, ExposedFields } from '@brisk/shared-types';
import { request } from './http-client';

export type ReusableSectionKind = 'shared' | 'template';

export interface ReusableSectionDto {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  kind: ReusableSectionKind;
  status: 'draft' | 'published';
  content: Block[];
  publishedContent: Block[] | null;
  exposedFields: ExposedFields;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The list row: a section plus how many pages place it (docs/adr/0059). */
export interface ReusableSectionListItemDto extends ReusableSectionDto {
  usedOnPages: number;
}

export function listReusableSections(
  siteId: string,
): Promise<ReusableSectionListItemDto[]> {
  const params = new URLSearchParams({ siteId });
  return request(`/reusable-sections?${params.toString()}`);
}

export function getReusableSection(id: string): Promise<ReusableSectionDto> {
  return request(`/reusable-sections/${id}`);
}

export function createReusableSection(input: {
  siteId: string;
  name: string;
  kind: ReusableSectionKind;
  content?: Block[];
}): Promise<ReusableSectionDto> {
  return request('/reusable-sections', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function saveDraft(
  id: string,
  content: Block[],
): Promise<ReusableSectionDto> {
  return request(`/reusable-sections/${id}/draft`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export function renameReusableSection(
  id: string,
  name: string,
): Promise<ReusableSectionDto> {
  return request(`/reusable-sections/${id}/name`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

/**
 * Which fields an instance may change. Its own endpoint, not part of the
 * draft: it is a rule about editing rather than content, so it takes
 * effect without republishing — the same separation `sticky` has on a
 * header (docs/adr/0018 follow-up).
 */
export function setExposedFields(
  id: string,
  exposedFields: ExposedFields,
): Promise<ReusableSectionDto> {
  return request(`/reusable-sections/${id}/exposed-fields`, {
    method: 'PATCH',
    body: JSON.stringify({ exposedFields }),
  });
}

export function publishReusableSection(
  id: string,
): Promise<ReusableSectionDto> {
  return request(`/reusable-sections/${id}/publish`, { method: 'POST' });
}

export function deleteReusableSection(id: string): Promise<{ deleted: true }> {
  return request(`/reusable-sections/${id}`, { method: 'DELETE' });
}

export interface ReusableSectionVersionDto {
  id: string;
  tenantId: string;
  reusableSectionId: string;
  content: Block[];
  createdBy: string | null;
  createdAt: string;
}

export function listVersions(id: string): Promise<ReusableSectionVersionDto[]> {
  return request(`/reusable-sections/${id}/versions`);
}

export function rollbackToVersion(
  id: string,
  versionId: string,
): Promise<ReusableSectionDto> {
  return request(`/reusable-sections/${id}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ versionId }),
  });
}
