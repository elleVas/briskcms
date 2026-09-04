import type {
  Form,
  FormSubmission,
  Media,
  PageGroup,
  PageGroupVersion,
  PageTranslation,
  PageTranslationVersion,
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
  PageGroupListFilters,
  PageGroupListItem,
  PageGroupRepositoryPort,
  PageGroupSummary,
  PageGroupVersionRepositoryPort,
  PageSearchResult,
  PageTranslationRepositoryPort,
  PageTranslationVersionRepositoryPort,
  PreviewToken,
  PreviewTokenPort,
  SearchPort,
  SiteLayoutSectionRepositoryPort,
  SiteLayoutSectionVersionRepositoryPort,
  SiteRepositoryPort,
  SiteThemeBlockStylesPort,
  AvailableTheme,
  ThemeCatalogPort,
  UploadMediaInput,
  UploadMediaResult,
  UserRepositoryPort,
} from '@brisk/ports';

export class InMemoryPageGroupRepository implements PageGroupRepositoryPort {
  private groups = new Map<string, PageGroup>();

  // Same reasoning as InMemoryPageRepository's own comment: both
  // repositories are shared collaborators, not a second internal store.
  // `translationRepository` is only needed for listBySiteFiltered (Fase 4)
  // — every other method predates it and doesn't touch translations at
  // all, hence it staying optional here too.
  constructor(
    private readonly versionRepository?: PageGroupVersionRepositoryPort,
    private readonly translationRepository?: PageTranslationRepositoryPort,
  ) {}

  async save(group: PageGroup): Promise<void> {
    this.groups.set(group.id, group);
  }

  async saveWithVersion(
    group: PageGroup,
    version: PageGroupVersion,
  ): Promise<void> {
    this.groups.set(group.id, group);
    await this.versionRepository?.save(version);
  }

  async findById(
    tenantId: string,
    pageGroupId: string,
  ): Promise<PageGroup | null> {
    const group = this.groups.get(pageGroupId);
    return group && group.tenantId === tenantId ? group : null;
  }

  async listBySite(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<PageGroupSummary>> {
    const matching = [...this.groups.values()].filter(
      (group) => group.tenantId === tenantId && group.siteId === siteId,
    );
    const start = (pagination.page - 1) * pagination.pageSize;
    return {
      items: matching
        .slice(start, start + pagination.pageSize)
        .map((group) => this.toSummary(group)),
      total: matching.length,
    };
  }

  async listBySiteFiltered(
    tenantId: string,
    siteId: string,
    pagination: Pagination,
    filters: PageGroupListFilters,
  ): Promise<PaginatedResult<PageGroupListItem>> {
    let matching = [...this.groups.values()].filter(
      (group) => group.tenantId === tenantId && group.siteId === siteId,
    );
    if (filters.createdAfter) {
      const after = filters.createdAfter;
      matching = matching.filter((group) => group.createdAt >= after);
    }
    if (filters.createdBefore) {
      const before = filters.createdBefore;
      matching = matching.filter((group) => group.createdAt <= before);
    }
    if (filters.createdBy) {
      matching = matching.filter(
        (group) => group.createdBy === filters.createdBy,
      );
    }

    const translationsByGroup = new Map<string, PageTranslation[]>();
    for (const group of matching) {
      translationsByGroup.set(
        group.id,
        this.translationRepository
          ? await this.translationRepository.listByGroup(tenantId, group.id)
          : [],
      );
    }

    if (filters.search) {
      const needle = filters.search.toLowerCase();
      matching = matching.filter((group) =>
        (translationsByGroup.get(group.id) ?? []).some((translation) =>
          translation.seoMeta.title.toLowerCase().includes(needle),
        ),
      );
    }
    if (filters.locale) {
      matching = matching.filter((group) =>
        (translationsByGroup.get(group.id) ?? []).some(
          (translation) => translation.locale === filters.locale,
        ),
      );
    }

    const start = (pagination.page - 1) * pagination.pageSize;
    return {
      items: matching
        .slice(start, start + pagination.pageSize)
        .map((group) => ({
          ...this.toSummary(group),
          createdByName: null,
          translations: (translationsByGroup.get(group.id) ?? []).map(
            (translation) => ({
              locale: translation.locale,
              slug: translation.slug,
              title: translation.seoMeta.title,
              status: translation.status,
              isDiverged: translation.isDiverged,
            }),
          ),
        })),
      total: matching.length,
    };
  }

  private toSummary(group: PageGroup): PageGroupSummary {
    const props = group.toProps();
    return {
      id: props.id,
      tenantId: props.tenantId,
      siteId: props.siteId,
      parentId: props.parentId,
      order: props.order,
      createdBy: props.createdBy,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    };
  }

  async listSiblings(
    tenantId: string,
    siteId: string,
    parentId: string | null,
  ): Promise<PageGroupSummary[]> {
    return [...this.groups.values()]
      .filter(
        (group) =>
          group.tenantId === tenantId &&
          group.siteId === siteId &&
          group.parentId === parentId,
      )
      .map((group) => this.toSummary(group))
      .sort(
        (a, b) =>
          a.order - b.order || a.createdAt.getTime() - b.createdAt.getTime(),
      );
  }

  async delete(tenantId: string, pageGroupId: string): Promise<void> {
    const group = this.groups.get(pageGroupId);
    if (group && group.tenantId === tenantId) {
      this.groups.delete(pageGroupId);
    }
  }
}

export class InMemoryPageGroupVersionRepository implements PageGroupVersionRepositoryPort {
  private versions: PageGroupVersion[] = [];

  async save(version: PageGroupVersion): Promise<void> {
    this.versions.push(version);
  }

  async findById(
    tenantId: string,
    versionId: string,
  ): Promise<PageGroupVersion | null> {
    return (
      this.versions.find(
        (v) => v.tenantId === tenantId && v.id === versionId,
      ) ?? null
    );
  }

  async listByGroup(
    tenantId: string,
    pageGroupId: string,
  ): Promise<PageGroupVersion[]> {
    return this.versions.filter(
      (v) => v.tenantId === tenantId && v.pageGroupId === pageGroupId,
    );
  }
}

export class InMemoryPageTranslationRepository implements PageTranslationRepositoryPort {
  private translations = new Map<string, PageTranslation>();
  // parentGroupId isn't stored on PageTranslation itself (see the port's
  // own doc comment) — the fake mirrors that by keeping it alongside the
  // entity instead of pretending it's a getter the entity has.
  private parentGroupIds = new Map<string, string | null>();

  constructor(
    private readonly versionRepository?: PageTranslationVersionRepositoryPort,
  ) {}

  async save(
    translation: PageTranslation,
    parentGroupId: string | null,
  ): Promise<void> {
    this.translations.set(translation.id, translation);
    this.parentGroupIds.set(translation.id, parentGroupId);
  }

  async saveWithVersion(
    translation: PageTranslation,
    version: PageTranslationVersion,
    parentGroupId: string | null,
  ): Promise<void> {
    await this.save(translation, parentGroupId);
    await this.versionRepository?.save(version);
  }

  async findById(
    tenantId: string,
    pageTranslationId: string,
  ): Promise<PageTranslation | null> {
    const translation = this.translations.get(pageTranslationId);
    return translation && translation.tenantId === tenantId
      ? translation
      : null;
  }

  async findByGroupAndLocale(
    tenantId: string,
    pageGroupId: string,
    locale: string,
  ): Promise<PageTranslation | null> {
    for (const translation of this.translations.values()) {
      if (
        translation.tenantId === tenantId &&
        translation.pageGroupId === pageGroupId &&
        translation.locale === locale
      ) {
        return translation;
      }
    }
    return null;
  }

  async listByGroup(
    tenantId: string,
    pageGroupId: string,
  ): Promise<PageTranslation[]> {
    return [...this.translations.values()].filter(
      (translation) =>
        translation.tenantId === tenantId &&
        translation.pageGroupId === pageGroupId,
    );
  }

  async findByParentGroupAndLocaleSlug(
    tenantId: string,
    siteId: string,
    locale: string,
    parentGroupId: string | null,
    slug: string,
  ): Promise<PageTranslation | null> {
    for (const translation of this.translations.values()) {
      if (
        translation.tenantId === tenantId &&
        translation.siteId === siteId &&
        translation.locale === locale &&
        translation.slug === slug &&
        this.parentGroupIds.get(translation.id) === parentGroupId
      ) {
        return translation;
      }
    }
    return null;
  }

  async delete(tenantId: string, pageTranslationId: string): Promise<void> {
    const translation = this.translations.get(pageTranslationId);
    if (translation && translation.tenantId === tenantId) {
      this.translations.delete(pageTranslationId);
      this.parentGroupIds.delete(pageTranslationId);
    }
  }
}

export class InMemoryPageTranslationVersionRepository implements PageTranslationVersionRepositoryPort {
  private versions: PageTranslationVersion[] = [];

  async save(version: PageTranslationVersion): Promise<void> {
    this.versions.push(version);
  }

  async findById(
    tenantId: string,
    versionId: string,
  ): Promise<PageTranslationVersion | null> {
    return (
      this.versions.find(
        (v) => v.tenantId === tenantId && v.id === versionId,
      ) ?? null
    );
  }

  async listByTranslation(
    tenantId: string,
    pageTranslationId: string,
  ): Promise<PageTranslationVersion[]> {
    return this.versions.filter(
      (v) =>
        v.tenantId === tenantId && v.pageTranslationId === pageTranslationId,
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

export class InMemoryThemeCatalog implements ThemeCatalogPort {
  constructor(
    private readonly themes: AvailableTheme[] = [{ name: 'classic' }],
  ) {}

  async listAvailableThemes(): Promise<AvailableTheme[]> {
    return this.themes;
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

  private byForm(formId: string): FormSubmission[] {
    return this.submissions.filter((s) => s.toProps().formId === formId);
  }

  async listByForm(
    _tenantId: string,
    formId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<FormSubmission>> {
    // Newest first, matching the real adapter — a test that asserts on
    // ordering has to be asserting on the same thing production does.
    const all = this.byForm(formId).sort(
      (a, b) =>
        b.toProps().createdAt.getTime() - a.toProps().createdAt.getTime(),
    );
    const start = (pagination.page - 1) * pagination.pageSize;
    return {
      items: all.slice(start, start + pagination.pageSize),
      total: all.length,
    };
  }

  async listAllByForm(
    _tenantId: string,
    formId: string,
  ): Promise<FormSubmission[]> {
    // Oldest first for the export, again matching the adapter.
    return this.byForm(formId).sort(
      (a, b) =>
        a.toProps().createdAt.getTime() - b.toProps().createdAt.getTime(),
    );
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
  indexed: {
    tenantId: string;
    siteId: string;
    translation: PageTranslation;
  }[] = [];
  results: PageSearchResult[] = [];

  async indexPage(
    tenantId: string,
    siteId: string,
    translation: PageTranslation,
  ): Promise<void> {
    this.indexed.push({ tenantId, siteId, translation });
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
