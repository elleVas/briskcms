import type { PageContent } from '@brisk/shared-types';

/**
 * Snapshot immutabile del contenuto di una SiteLayoutSection in un dato
 * istante. Ogni salvataggio (create, saveDraft, rollback) ne crea una
 * nuova riga — mai un overwrite distruttivo, stesso invariante di
 * PageVersion/SiteLayoutSection.restoreContent().
 */
export interface SiteLayoutSectionVersion {
  id: string;
  tenantId: string;
  siteLayoutSectionId: string;
  content: PageContent;
  createdBy: string | null;
  createdAt: Date;
}
