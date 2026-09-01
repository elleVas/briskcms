import type { FieldValueOverlay, SeoMeta } from '@brisk/shared-types';

/**
 * Snapshot immutabile del testo per-locale (overlay + seoMeta) di una
 * PageTranslation in un dato istante — il secondo stream di versioning
 * parallelo (vedi PageGroupVersion per la struttura condivisa). Riguarda
 * solo una traduzione COLLEGATA: una traduzione scollegata (`isDiverged`)
 * ha un proprio `divergedContent` completo, versionato invece come
 * PageGroupVersion (stessa forma, stesso use-case) — non ha più senso
 * "solo overlay" una volta forkata.
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
