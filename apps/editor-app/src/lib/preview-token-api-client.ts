import { request } from './http-client';

export interface PreviewTokenDto {
  token: string;
  expiresAt: string;
}

/** Vedi POST /pages/:id/preview-token — token scoped a questa pagina, TTL corto (vedi PREVIEW_TOKEN_TTL_MS lato API). */
export function createPagePreviewToken(
  pageId: string,
): Promise<PreviewTokenDto> {
  return request(`/pages/${pageId}/preview-token`, { method: 'POST' });
}

/** Vedi POST /site-layout-sections/:id/preview-token — stesso meccanismo, per header/footer. */
export function createSiteLayoutSectionPreviewToken(
  sectionId: string,
): Promise<PreviewTokenDto> {
  return request(`/site-layout-sections/${sectionId}/preview-token`, {
    method: 'POST',
  });
}

/** See POST /page-groups/translations/:id/preview-token — field-level i18n, the same mechanism scoped to ONE translation rather than to the old Page. */
export function createTranslationPreviewToken(
  translationId: string,
): Promise<PreviewTokenDto> {
  return request(`/page-groups/translations/${translationId}/preview-token`, {
    method: 'POST',
  });
}
