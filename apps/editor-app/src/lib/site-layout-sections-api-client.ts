import type { Block } from '@brisk/shared-types';
import { request } from './http-client';

export type SiteLayoutSectionKind = 'header' | 'footer';

export interface SiteLayoutSectionDto {
  id: string;
  tenantId: string;
  siteId: string;
  locale: string;
  kind: SiteLayoutSectionKind;
  status: 'draft' | 'published';
  content: Block[];
  publishedContent: Block[] | null;
  sticky: boolean;
  createdAt: string;
  updatedAt: string;
}

// Always creates the row implicitly the first time it's called for a given
// (site, locale, kind) — see getOrCreateSiteLayoutSection (docs/adr/0018),
// so the editor never has to handle a "doesn't exist yet" state.
export function getOrCreateSiteLayoutSection(
  siteId: string,
  locale: string,
  kind: SiteLayoutSectionKind,
): Promise<SiteLayoutSectionDto> {
  const params = new URLSearchParams({ siteId, locale, kind });
  return request(`/site-layout-sections?${params.toString()}`);
}

export function saveDraft(
  id: string,
  content: Block[],
): Promise<SiteLayoutSectionDto> {
  return request(`/site-layout-sections/${id}/draft`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export function publishSiteLayoutSection(
  id: string,
): Promise<SiteLayoutSectionDto> {
  return request(`/site-layout-sections/${id}/publish`, { method: 'POST' });
}

// Not part of content/draft-publish (docs/adr/0018 follow-up) — a display
// setting that takes effect immediately, so it's its own endpoint rather
// than folded into saveDraft's body.
export function updateSticky(
  id: string,
  sticky: boolean,
): Promise<SiteLayoutSectionDto> {
  return request(`/site-layout-sections/${id}/sticky`, {
    method: 'PATCH',
    body: JSON.stringify({ sticky }),
  });
}

export interface SiteLayoutSectionVersionDto {
  id: string;
  tenantId: string;
  siteLayoutSectionId: string;
  content: Block[];
  createdBy: string | null;
  createdAt: string;
}

export function listVersions(
  id: string,
): Promise<SiteLayoutSectionVersionDto[]> {
  return request(`/site-layout-sections/${id}/versions`);
}

export function rollbackToVersion(
  id: string,
  versionId: string,
): Promise<SiteLayoutSectionDto> {
  return request(`/site-layout-sections/${id}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ versionId }),
  });
}
