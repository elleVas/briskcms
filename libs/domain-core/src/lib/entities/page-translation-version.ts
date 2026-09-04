import type { FieldValueOverlay, SeoMeta } from '@brisk/shared-types';

/**
 * An immutable snapshot of a PageTranslation's per-locale text (overlay
 * plus seoMeta) at a point in time — the second parallel versioning stream
 * (see PageGroupVersion for the shared structure). It concerns only a
 * LINKED translation: an unlinked one (`isDiverged`) has a complete
 * `divergedContent` of its own, versioned as a PageGroupVersion instead
 * (the same shape, the same use case) — "overlay only" stops making sense
 * once it has forked.
 */
export interface PageTranslationVersion {
  id: string;
  tenantId: string;
  pageTranslationId: string;
  fieldValues: FieldValueOverlay;
  seoMeta: SeoMeta;
  createdBy: string | null;
  createdAt: Date;
}
