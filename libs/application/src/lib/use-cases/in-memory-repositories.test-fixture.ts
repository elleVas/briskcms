import type { Page, PageVersion } from '@brisk/domain-core';
import type { PageRepositoryPort, PageVersionRepositoryPort } from '@brisk/ports';

export class InMemoryPageRepository implements PageRepositoryPort {
  private pages = new Map<string, Page>();

  async save(page: Page): Promise<void> {
    this.pages.set(page.id, page);
  }

  async findById(tenantId: string, pageId: string): Promise<Page | null> {
    const page = this.pages.get(pageId);
    return page && page.tenantId === tenantId ? page : null;
  }

  async findBySlug(
    tenantId: string,
    siteId: string,
    locale: string,
    slug: string,
  ): Promise<Page | null> {
    for (const page of this.pages.values()) {
      if (
        page.tenantId === tenantId &&
        page.siteId === siteId &&
        page.locale === locale &&
        page.slug === slug
      ) {
        return page;
      }
    }
    return null;
  }

  async delete(tenantId: string, pageId: string): Promise<void> {
    const page = this.pages.get(pageId);
    if (page && page.tenantId === tenantId) {
      this.pages.delete(pageId);
    }
  }
}

export class InMemoryPageVersionRepository implements PageVersionRepositoryPort {
  private versions: PageVersion[] = [];

  async save(version: PageVersion): Promise<void> {
    this.versions.push(version);
  }

  async findById(tenantId: string, versionId: string): Promise<PageVersion | null> {
    return this.versions.find((v) => v.tenantId === tenantId && v.id === versionId) ?? null;
  }

  async listByPage(tenantId: string, pageId: string): Promise<PageVersion[]> {
    return this.versions.filter((v) => v.tenantId === tenantId && v.pageId === pageId);
  }
}
