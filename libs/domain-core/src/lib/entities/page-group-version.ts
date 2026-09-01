import type { PageContent } from '@brisk/shared-types';

/**
 * Snapshot immutabile della struttura CONDIVISA di un PageGroup in un dato
 * istante — uno dei due stream di versioning paralleli del nuovo modello
 * i18n (l'altro è PageTranslationVersion, per il testo per-locale). Stessa
 * disciplina di PageVersion: mai un overwrite distruttivo, una nuova riga
 * per ogni saveContent().
 */
export interface PageGroupVersion {
  id: string;
  tenantId: string;
  pageGroupId: string;
  content: PageContent;
  createdBy: string | null;
  createdAt: Date;
}
