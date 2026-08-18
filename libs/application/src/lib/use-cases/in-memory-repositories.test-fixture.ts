import type { Page, PageVersion, User } from '@brisk/domain-core';
import type {
  PageRepositoryPort,
  PageVersionRepositoryPort,
  UserRepositoryPort,
} from '@brisk/ports';

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

  async listBySite(tenantId: string, siteId: string): Promise<Page[]> {
    return [...this.pages.values()].filter(
      (page) => page.tenantId === tenantId && page.siteId === siteId,
    );
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

  async findById(
    tenantId: string,
    versionId: string,
  ): Promise<PageVersion | null> {
    return (
      this.versions.find(
        (v) => v.tenantId === tenantId && v.id === versionId,
      ) ?? null
    );
  }

  async listByPage(tenantId: string, pageId: string): Promise<PageVersion[]> {
    return this.versions.filter(
      (v) => v.tenantId === tenantId && v.pageId === pageId,
    );
  }
}

export class InMemoryUserRepository implements UserRepositoryPort {
  private users = new Map<string, User>();

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async findById(tenantId: string, userId: string): Promise<User | null> {
    const user = this.users.get(userId);
    return user && user.tenantId === tenantId ? user : null;
  }

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.tenantId === tenantId && user.email === email) {
        return user;
      }
    }
    return null;
  }
}
