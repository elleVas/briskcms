import type {
  Form,
  FormSubmission,
  Media,
  Page,
  PageVersion,
  PreviewContentType,
  Site,
  SiteLayoutSection,
  SiteLayoutSectionKind,
  SiteLayoutSectionVersion,
  User,
} from '@brisk/domain-core';
import type { BlockStyleOverride } from '@brisk/shared-types';
import type {
  FormRepositoryPort,
  FormSubmissionRepositoryPort,
  MediaRepositoryPort,
  MediaStoragePort,
  PaginatedResult,
  Pagination,
  PageRepositoryPort,
  PageSearchResult,
  PageSummary,
  PageVersionRepositoryPort,
  PreviewToken,
  PreviewTokenPort,
  SearchPort,
  SiteLayoutSectionRepositoryPort,
  SiteLayoutSectionVersionRepositoryPort,
  SiteRepositoryPort,
  SiteThemeBlockStylesPort,
  UploadMediaInput,
  UploadMediaResult,
  UserRepositoryPort,
} from '@brisk/ports';

export class InMemoryPageRepository implements PageRepositoryPort {
  private pages = new Map<string, Page>();

  /**
   * Il repository delle versioni è un collaboratore opzionale, non un
   * secondo store interno — `saveWithVersion` deve scrivere nello STESSO
   * `InMemoryPageVersionRepository` che il test costruisce e interroga
   * (`listByPage`/`findById`), altrimenti la versione "sparirebbe" agli
   * occhi delle asserzioni pur essendo stata scritta. Rispecchia
   * `DrizzlePageRepository.saveWithVersion`, che scrive nella stessa
   * tabella `page_versions` di `DrizzlePageVersionRepository`, solo nella
   * stessa transazione invece che nello stesso Map.
   */
  constructor(private readonly versionRepository?: PageVersionRepositoryPort) {}

  async save(page: Page): Promise<void> {
    this.pages.set(page.id, page);
  }

  async saveWithVersion(page: Page, version: PageVersion): Promise<void> {
    this.pages.set(page.id, page);
    await this.versionRepository?.save(version);
  }

  async findById(tenantId: string, pageId: string): Promise<Page | null> {
    const page = this.pages.get(pageId);
    return page && page.tenantId === tenantId ? page : null;
  }

  async findByParentAndSlug(
    tenantId: string,
    siteId: string,
    locale: string,
    parentId: string | null,
    slug: string,
  ): Promise<Page | null> {
    for (const page of this.pages.values()) {
      if (
        page.tenantId === tenantId &&
        page.siteId === siteId &&
        page.locale === locale &&
        page.parentId === parentId &&
        page.slug === slug
      ) {
        return page;
      }
    }
    return null;
  }

  async listBySite(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<PageSummary>> {
    const matching = [...this.pages.values()].filter(
      (page) => page.tenantId === tenantId && page.siteId === siteId,
    );
    const start = (pagination.page - 1) * pagination.pageSize;
    return {
      items: matching
        .slice(start, start + pagination.pageSize)
        .map((page) => this.toSummary(page)),
      total: matching.length,
    };
  }

  private toSummary(page: Page): PageSummary {
    const props = page.toProps();
    return {
      id: props.id,
      tenantId: props.tenantId,
      siteId: props.siteId,
      groupId: props.groupId,
      locale: props.locale,
      slug: props.slug,
      parentId: props.parentId,
      status: props.status,
      seoMeta: props.seoMeta,
      order: props.order,
      // No user repository wired into this fixture — business-logic specs
      // don't need a real name, only the real Drizzle adapter resolves
      // this (see its own integration tests).
      createdByName: null,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      hasUnpublishedChanges:
        props.status === 'published' &&
        JSON.stringify(props.publishedContent) !==
          JSON.stringify(props.content),
    };
  }

  async listSiblings(
    tenantId: string,
    siteId: string,
    locale: string,
    parentId: string | null,
  ): Promise<PageSummary[]> {
    return [...this.pages.values()]
      .filter(
        (page) =>
          page.tenantId === tenantId &&
          page.siteId === siteId &&
          page.locale === locale &&
          page.parentId === parentId,
      )
      .map((page) => this.toSummary(page))
      .sort(
        (a, b) =>
          a.order - b.order || a.createdAt.getTime() - b.createdAt.getTime(),
      );
  }

  async listByGroup(
    tenantId: string,
    siteId: string,
    groupId: string,
  ): Promise<Page[]> {
    return [...this.pages.values()].filter(
      (page) =>
        page.tenantId === tenantId &&
        page.siteId === siteId &&
        page.groupId === groupId,
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

  async list(
    tenantId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<User>> {
    const matching = [...this.users.values()]
      .filter((user) => user.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (pagination.page - 1) * pagination.pageSize;
    return {
      items: matching.slice(start, start + pagination.pageSize),
      total: matching.length,
    };
  }
}

export class InMemorySiteRepository implements SiteRepositoryPort {
  private sites = new Map<string, Site>();

  async save(site: Site): Promise<void> {
    this.sites.set(site.id, site);
  }

  async findByDomain(tenantId: string, domain: string): Promise<Site | null> {
    for (const site of this.sites.values()) {
      if (site.tenantId === tenantId && site.domain === domain) {
        return site;
      }
    }
    return null;
  }

  async findById(tenantId: string, id: string): Promise<Site | null> {
    const site = this.sites.get(id);
    return site && site.tenantId === tenantId ? site : null;
  }
}

export class InMemorySiteThemeBlockStylesRepository implements SiteThemeBlockStylesPort {
  private styles = new Map<string, Record<string, BlockStyleOverride>>();

  private key(tenantId: string, siteId: string): string {
    return `${tenantId}:${siteId}`;
  }

  async listBySite(
    tenantId: string,
    siteId: string,
  ): Promise<Record<string, BlockStyleOverride>> {
    return { ...(this.styles.get(this.key(tenantId, siteId)) ?? {}) };
  }

  async upsert(
    tenantId: string,
    siteId: string,
    blockType: string,
    style: BlockStyleOverride,
  ): Promise<void> {
    const key = this.key(tenantId, siteId);
    const existing = this.styles.get(key) ?? {};
    this.styles.set(key, { ...existing, [blockType]: style });
  }
}

export class InMemorySiteLayoutSectionRepository implements SiteLayoutSectionRepositoryPort {
  private sections = new Map<string, SiteLayoutSection>();

  async save(section: SiteLayoutSection): Promise<void> {
    this.sections.set(section.id, section);
  }

  async findById(
    tenantId: string,
    id: string,
  ): Promise<SiteLayoutSection | null> {
    const section = this.sections.get(id);
    return section && section.tenantId === tenantId ? section : null;
  }

  async findBySiteLocaleKind(
    tenantId: string,
    siteId: string,
    locale: string,
    kind: SiteLayoutSectionKind,
  ): Promise<SiteLayoutSection | null> {
    for (const section of this.sections.values()) {
      if (
        section.tenantId === tenantId &&
        section.siteId === siteId &&
        section.locale === locale &&
        section.kind === kind
      ) {
        return section;
      }
    }
    return null;
  }
}

export class InMemorySiteLayoutSectionVersionRepository implements SiteLayoutSectionVersionRepositoryPort {
  private versions: SiteLayoutSectionVersion[] = [];

  async save(version: SiteLayoutSectionVersion): Promise<void> {
    this.versions.push(version);
  }

  async findById(
    tenantId: string,
    versionId: string,
  ): Promise<SiteLayoutSectionVersion | null> {
    return (
      this.versions.find(
        (v) => v.tenantId === tenantId && v.id === versionId,
      ) ?? null
    );
  }

  async listBySection(
    tenantId: string,
    siteLayoutSectionId: string,
  ): Promise<SiteLayoutSectionVersion[]> {
    return this.versions.filter(
      (v) =>
        v.tenantId === tenantId &&
        v.siteLayoutSectionId === siteLayoutSectionId,
    );
  }
}

export class InMemoryMediaRepository implements MediaRepositoryPort {
  private media = new Map<string, Media>();

  async save(media: Media): Promise<void> {
    this.media.set(media.id, media);
  }

  async findById(tenantId: string, mediaId: string): Promise<Media | null> {
    const media = this.media.get(mediaId);
    return media && media.tenantId === tenantId ? media : null;
  }

  async listBySite(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<Media>> {
    const matching = [...this.media.values()]
      .filter((m) => m.tenantId === tenantId && m.siteId === siteId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (pagination.page - 1) * pagination.pageSize;
    return {
      items: matching.slice(start, start + pagination.pageSize),
      total: matching.length,
    };
  }

  async delete(tenantId: string, mediaId: string): Promise<void> {
    const media = this.media.get(mediaId);
    if (media && media.tenantId === tenantId) {
      this.media.delete(mediaId);
    }
  }
}

export class InMemoryFormRepository implements FormRepositoryPort {
  private forms = new Map<string, Form>();

  async save(form: Form): Promise<void> {
    this.forms.set(form.id, form);
  }

  async findById(tenantId: string, formId: string): Promise<Form | null> {
    const form = this.forms.get(formId);
    return form && form.tenantId === tenantId ? form : null;
  }

  async listBySite(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<Form>> {
    const matching = [...this.forms.values()]
      .filter((f) => f.tenantId === tenantId && f.siteId === siteId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const start = (pagination.page - 1) * pagination.pageSize;
    return {
      items: matching.slice(start, start + pagination.pageSize),
      total: matching.length,
    };
  }

  async delete(tenantId: string, formId: string): Promise<void> {
    const form = this.forms.get(formId);
    if (form && form.tenantId === tenantId) {
      this.forms.delete(formId);
    }
  }
}

export class InMemoryFormSubmissionRepository implements FormSubmissionRepositoryPort {
  readonly submissions: FormSubmission[] = [];

  async save(submission: FormSubmission): Promise<void> {
    this.submissions.push(submission);
  }
}

/** Fake, not a real storage backend — records what was uploaded/deleted so
 * use-case tests can assert on the interaction without touching disk/S3. */
export class InMemoryMediaStorage implements MediaStoragePort {
  readonly provider = 'local' as const;
  uploads: UploadMediaInput[] = [];
  deletedKeys: string[] = [];

  async upload(input: UploadMediaInput): Promise<UploadMediaResult> {
    this.uploads.push(input);
    return {
      storageKey: `fake-${this.uploads.length}.webp`,
      mimeType: 'image/webp',
      size: input.data.byteLength,
      width: 800,
      height: 600,
    };
  }

  getUrl(storageKey: string): string {
    return `https://fake-storage.test/${storageKey}`;
  }

  async delete(storageKey: string): Promise<void> {
    this.deletedKeys.push(storageKey);
  }
}

export class InMemorySearchPort implements SearchPort {
  indexed: { tenantId: string; siteId: string; page: Page }[] = [];
  results: PageSearchResult[] = [];

  async indexPage(tenantId: string, siteId: string, page: Page): Promise<void> {
    this.indexed.push({ tenantId, siteId, page });
  }

  async search(): Promise<PageSearchResult[]> {
    return this.results;
  }
}

export class InMemoryPreviewTokenPort implements PreviewTokenPort {
  private tokens = new Map<string, PreviewToken>();

  async createToken(
    tenantId: string,
    contentType: PreviewContentType,
    contentId: string,
    ttlMs: number,
  ): Promise<PreviewToken> {
    const token = `preview-token-${this.tokens.size + 1}`;
    const previewToken: PreviewToken = {
      token,
      tenantId,
      contentType,
      contentId,
      expiresAt: new Date(Date.now() + ttlMs),
    };
    this.tokens.set(token, previewToken);
    return previewToken;
  }

  async validateToken(
    token: string,
    contentType: PreviewContentType,
    contentId: string,
  ): Promise<PreviewToken | null> {
    const found = this.tokens.get(token);
    if (
      !found ||
      found.contentType !== contentType ||
      found.contentId !== contentId
    ) {
      return null;
    }
    if (found.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return found;
  }
}
