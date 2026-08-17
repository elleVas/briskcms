import type { PageContent } from '@brisk/shared-types';

/**
 * Snapshot immutabile del contenuto di una pagina in un dato istante.
 * Ogni salvataggio (create, saveDraft, rollback) ne crea una nuova riga —
 * mai un overwrite distruttivo, vedi Page.restoreContent().
 */
export interface PageVersion {
  id: string;
  tenantId: string;
  pageId: string;
  content: PageContent;
  createdBy: string | null;
  createdAt: Date;
}
