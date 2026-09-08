import type { ReusableSection } from '@brisk/domain-core';

/**
 * Every method takes tenantId explicitly, the same principle as
 * PageRepositoryPort — the database policy is the second barrier, not the
 * first one.
 *
 * `delete` exists here where SiteLayoutSectionRepositoryPort deliberately
 * omits it: a header cannot be deleted because there is always exactly one,
 * while a section an agency built by hand can turn out to be a mistake.
 * What deleting one does to the pages that reference it is decided in the
 * use case, not here (docs/adr/0059: the instance keeps rendering as an
 * empty strip rather than taking the page down).
 */
export interface ReusableSectionRepositoryPort {
  save(section: ReusableSection): Promise<void>;
  findById(tenantId: string, id: string): Promise<ReusableSection | null>;
  findByIds(tenantId: string, ids: string[]): Promise<ReusableSection[]>;
  listBySite(tenantId: string, siteId: string): Promise<ReusableSection[]>;
  delete(tenantId: string, id: string): Promise<void>;
}
