import {
  DEFAULT_COOKIE_BANNER_SETTINGS,
  type CollectionRecord,
  type PageGroupListItemRecord,
  type PageGroupListItemTranslation,
  type PageGroupRecord,
  type PageGroupVersionRecord,
  type PageTranslationRecord,
  type SiteRecord,
} from '@brisk/shared-types';

/*
 * One builder per wire record a spec needs and does not care about in full
 * — what `apps/api` sends and `apps/editor-app` parses.
 *
 * The defaults describe the same site as the entity builders next door
 * (`site-1` in `tenant-1`, an Italian page `group-1` whose translation is
 * `home`), as the API would serialize it. A spec that mixes the two layers
 * finds them agreeing, and one that needs a value of its own passes it as
 * an override.
 *
 * Exported from `@brisk/testing/records`, not from the package root: these
 * depend on `@brisk/shared-types` only, so the editor's specs can use them
 * without loading the domain entities and ports the root brings along.
 */

/** Every timestamp a record carries by default: the entity builders' `createdAt`, as the wire spells it. */
const CREATED_AT = '2026-01-01T00:00:00.000Z';

export function buildSiteRecord(
  overrides: Partial<SiteRecord> = {},
): SiteRecord {
  return {
    id: 'site-1',
    tenantId: 'tenant-1',
    name: 'Test site',
    domain: 'example.com',
    themeName: 'classic',
    defaultLocale: 'it',
    enabledLocales: ['it'],
    untranslatedPageFallback: 'redirect-to-default',
    businessAddress: null,
    businessPhone: null,
    businessEmail: null,
    businessType: null,
    openingHours: null,
    searchEngineIndexingEnabled: false,
    formSubmissionRetentionDays: null,
    themePrimaryColor: null,
    themeSecondaryColor: null,
    themeFontFamily: null,
    themeCustomCss: null,
    themeContentWidth: null,
    themeHeadScript: null,
    themeBodyScript: null,
    themeFaviconUrl: null,
    themeOverridesEnabled: true,
    themeAllowedTrackerDomains: [],
    themeTrackerScripts: [],
    cookieBannerSettings: DEFAULT_COOKIE_BANNER_SETTINGS,
    themeTokens: { blockStyles: {} },
    createdAt: CREATED_AT,
    ...overrides,
  };
}

export function buildPageGroupRecord(
  overrides: Partial<PageGroupRecord> = {},
): PageGroupRecord {
  return {
    id: 'group-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    parentId: null,
    order: 0,
    collectionId: null,
    content: [],
    createdBy: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

/** A translation as `PageTranslation.create` leaves it: a draft, never published, following the group's content. */
export function buildPageTranslationRecord(
  overrides: Partial<PageTranslationRecord> = {},
): PageTranslationRecord {
  return {
    id: 'translation-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    pageGroupId: 'group-1',
    locale: 'it',
    slug: 'home',
    seoMeta: { title: 'Home', description: '' },
    fieldValues: {},
    status: 'draft',
    publishedSnapshot: null,
    isDiverged: false,
    divergedContent: null,
    createdBy: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

/** One language of a pages-list row — the default translation, summarized. */
export function buildPageGroupListItemTranslation(
  overrides: Partial<PageGroupListItemTranslation> = {},
): PageGroupListItemTranslation {
  return {
    locale: 'it',
    slug: 'home',
    title: 'Home',
    status: 'draft',
    isDiverged: false,
    hasUnpublishedChanges: false,
    ...overrides,
  };
}

/** A pages-list row: the default group, with its one translation. */
export function buildPageGroupListItemRecord(
  overrides: Partial<PageGroupListItemRecord> = {},
): PageGroupListItemRecord {
  return {
    id: 'group-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    parentId: null,
    order: 0,
    collectionId: null,
    createdByName: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    lastEditedAt: CREATED_AT,
    lastEditedByName: null,
    translations: [buildPageGroupListItemTranslation()],
    ...overrides,
  };
}

export function buildPageGroupVersionRecord(
  overrides: Partial<PageGroupVersionRecord> = {},
): PageGroupVersionRecord {
  return {
    id: 'version-1',
    tenantId: 'tenant-1',
    pageGroupId: 'group-1',
    content: [],
    createdBy: null,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

export function buildCollectionRecord(
  overrides: Partial<CollectionRecord> = {},
): CollectionRecord {
  return {
    id: 'collection-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    name: 'News',
    icon: 'newspaper',
    order: 0,
    defaultTemplateId: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}
