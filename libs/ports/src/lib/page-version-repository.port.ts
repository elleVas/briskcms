import type { PageVersion } from '@brisk/domain-core';

export interface PageVersionRepositoryPort {
  save(version: PageVersion): Promise<void>;
  findById(tenantId: string, versionId: string): Promise<PageVersion | null>;
  listByPage(tenantId: string, pageId: string): Promise<PageVersion[]>;
}
