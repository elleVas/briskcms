import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type {
  BlockStyleOverride,
  CookieBannerSettings,
  FieldValueOverlay,
  FormField,
  FormStep,
  OpeningHoursDay,
  PageContent,
  SeoMeta,
  TrackerDomainEntry,
  TrackerScriptEntry,
} from '@brisk/shared-types';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';

// One native Postgres enum type per domain string-union, matching the
// literal values of the corresponding domain-core/shared-types type
// exactly — kept separate even where two enums share the same value set
// (pageTranslationStatusEnum/siteLayoutSectionStatusEnum both
// 'draft'|'published') because their domain types are deliberately
// distinct (PageTranslation vs. SiteLayoutSection), see
// db-schema-cleanup-deferred-2026-08-28 memory.
export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'publisher',
  'editor',
]);
export const untranslatedPageFallbackEnum = pgEnum(
  'untranslated_page_fallback',
  ['redirect-to-default', 'not-available'],
);
export const pageTranslationStatusEnum = pgEnum('page_translation_status', [
  'draft',
  'published',
]);
export const siteLayoutSectionKindEnum = pgEnum('site_layout_section_kind', [
  'header',
  'footer',
]);
export const siteLayoutSectionStatusEnum = pgEnum(
  'site_layout_section_status',
  ['draft', 'published'],
);
export const storageProviderEnum = pgEnum('storage_provider', ['local', 's3']);
export const verificationTokenPurposeEnum = pgEnum(
  'verification_token_purpose',
  ['email-verification', 'password-reset', 'user-invite'],
);

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    // Nullable, not backfilled: existing users (incl. the dev seed admin)
    // predate this column. UI falls back to `email` when null, same
    // pattern as `seoMeta.title || slug` elsewhere in this codebase.
    displayName: text('display_name'),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull(),
    // False for a freshly-invited user who hasn't accepted yet, or an
    // admin-deactivated one — see the domain entity's own doc comment.
    isActive: boolean('is_active').notNull().default(true),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.tenantId, table.email)],
);

export const sites = pgTable(
  'sites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    domain: text('domain'),
    defaultLocale: text('default_locale').notNull(),
    enabledLocales: text('enabled_locales').array().notNull().default([]),
    // What a visitor sees for a page not translated into their locale
    // (Fase 5b, docs/adr/0017) — 'redirect-to-default' is the friendlier
    // default for a fresh site over silently 404ing.
    untranslatedPageFallback: untranslatedPageFallbackEnum(
      'untranslated_page_fallback',
    )
      .notNull()
      .default('redirect-to-default'),
    // schema.org LocalBusiness fields (docs/adr/0014) — all nullable, a site
    // with none of them set renders plain WebSite/WebPage instead.
    businessAddress: text('business_address'),
    businessPhone: text('business_phone'),
    businessType: text('business_type'),
    openingHours: jsonb('opening_hours').$type<OpeningHoursDay[]>(),
    // Defaults to false (opt-in): a site mid-build shouldn't be indexed until
    // its owner deliberately decides it's ready — see Site.searchEngineIndexingEnabled.
    searchEngineIndexingEnabled: boolean('search_engine_indexing_enabled')
      .notNull()
      .default(false),
    // Tier 2 of docs/adr/0021's theming model (docs/adr/0042) — which
    // bundled filesystem theme this site renders, resolved per-request.
    // Distinct from the Tier 1 theme* columns below (those layer style
    // overrides ON TOP of whichever theme this field names). Defaults to
    // 'classic' so an existing site gets the same behavior it always had
    // the moment this column appears — not a nullable "inherit" field
    // like Tier 1, since Tier 2 has no equivalent lower layer to fall
    // back to.
    themeName: text('theme_name').notNull().default('classic'),
    // Tier 1 of docs/adr/0021's theming model — all nullable, `null` means
    // "inherit the active filesystem theme's own default" (Tier 2), not a
    // value coerced here at the DB layer. See Site.themeSettings.
    themePrimaryColor: text('theme_primary_color'),
    themeSecondaryColor: text('theme_secondary_color'),
    themeFontFamily: text('theme_font_family'),
    themeCustomCss: text('theme_custom_css'),
    themeHeadScript: text('theme_head_script'),
    themeBodyScript: text('theme_body_script'),
    themeFaviconUrl: text('theme_favicon_url'),
    // Site-level gate under the theme's own theme.json ceiling
    // (docs/adr/0021) — defaults true so an existing/fresh site with no
    // Tier 1 fields set behaves identically to before this column existed.
    themeOverridesEnabled: boolean('theme_overrides_enabled')
      .notNull()
      .default(true),
    // ADR-0031 — admin-managed CSP domain whitelist for trackers beyond the
    // hardcoded GTM/GA4/Meta Pixel allowlist. Independent of
    // themeOverridesEnabled above: a tracker script shouldn't stop running
    // just because someone toggled off color/font overrides.
    themeAllowedTrackerDomains: jsonb('theme_allowed_tracker_domains')
      .notNull()
      .default([])
      .$type<TrackerDomainEntry[]>(),
    // GDPR/privacy: `null` (default) keeps every submission forever, same
    // behavior as before this column existed. A positive integer is the
    // number of days a form_submissions row survives past its createdAt
    // before the scheduled cleanup (FormSubmissionsRetentionCleanupService)
    // deletes it — see deleteExpiredFormSubmissions.
    formSubmissionRetentionDays: integer('form_submission_retention_days'),
    // Cookie consent (docs/adr/0039): categorized tracker snippets, gated
    // by consent category at render time — the structured alternative to
    // the always-on themeHeadScript/themeBodyScript above. Lives under the
    // same admin-gated PATCH /sites/:id/theme-settings endpoint since it's
    // still admin-trusted raw HTML, unlike cookieBannerSettings below.
    themeTrackerScripts: jsonb('theme_tracker_scripts')
      .notNull()
      .default([])
      .$type<TrackerScriptEntry[]>(),
    // Cookie consent banner config (docs/adr/0039) — inert config (position/
    // copy/toggles), not raw HTML, so it lives behind its own endpoint with
    // no role gate. Defaults to disabled: an existing site never gains a
    // banner it didn't ask for just because this column exists.
    cookieBannerSettings: jsonb('cookie_banner_settings')
      .notNull()
      .default(DEFAULT_COOKIE_BANNER_SETTINGS)
      .$type<CookieBannerSettings>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // findByDomain() is the hot path of every public request (page
    // rendering, sitemap, search, site chrome) — without this index it does
    // a sequential scan. The UNIQUE constraint it brings along is the more
    // important part: without it, two sites of the same tenant could share
    // a domain (nothing prevents it at the application level), and
    // findByDomain (which uses .limit(1) with no ORDER BY) would serve one
    // of the two indeterminately. `domain` stays nullable — Postgres treats
    // multiple NULLs as always distinct under UNIQUE, so several sites of
    // the same tenant with no domain configured yet coexist without
    // conflict.
    unique().on(table.tenantId, table.domain),
  ],
);

/**
 * Replaces `sites.theme_tokens` (which was a single JSONB map spread across
 * the site's row) — one row per (site, block type) instead of an entry
 * nested in a blob. Not for correctness (the previous
 * `UPDATE ... jsonb_set` was already atomic per type) but for two real
 * reasons: a write here no longer rewrites the whole wide `sites` row under
 * MVCC (name, domain, SEO settings, and so on — all unrelated to styling),
 * and `WHERE block_type = 'Button'` becomes an ordinary index lookup rather
 * than a JSONB path traversal. `style` stays jsonb (not typed columns per
 * property): adding or removing a stylable property remains a data change
 * rather than a migration — the same reason `blockStyles` was already a
 * generic map.
 */
export const siteThemeBlockStyles = pgTable(
  'site_theme_block_styles',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    blockType: text('block_type').notNull(),
    style: jsonb('style').notNull().$type<BlockStyleOverride>(),
  },
  (table) => [
    primaryKey({ columns: [table.siteId, table.blockType] }),
    index('site_theme_block_styles_tenant_site_idx').on(
      table.tenantId,
      table.siteId,
    ),
  ],
);

// Field-level i18n (a shared structure plus per-locale overrides) —
// pageGroups/pageTranslations replaced the old `pages` table (removed in
// the plan's phase 5). A PageGroup owns the structure SHARED across every
// language; a PageTranslation owns the per-locale text.
export const pageGroups = pgTable(
  'page_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    // A hierarchy SHARED across every language — unlike the old
    // pages.parentId (which was per-locale), it makes no sense for two
    // languages of the same page to live at different points in the site's
    // tree.
    parentId: uuid('parent_id').references((): AnyPgColumn => pageGroups.id, {
      onDelete: 'set null',
    }),
    // The canonical block tree — for a field marked `translatable`
    // (FieldDescriptor in @brisk/block-registry), the value here is the
    // site's default language's, the fallback used until a pageTranslation
    // has an override of its own (see mergeTranslatedContent in
    // @brisk/shared-types).
    content: jsonb('content').notNull().default([]).$type<PageContent>(),
    // Sibling-scoped, and shared for the same reason as parentId — with the
    // same DB-level non-uniqueness as the old pages.order (a temporary
    // duplicate halfway through a reorder is harmless, see
    // reorderSiblingPages).
    order: integer('order').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('page_groups_tenant_site_idx').on(table.tenantId, table.siteId),
  ],
);

export const pageTranslations = pgTable(
  'page_translations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    // Denormalized from pageGroups.siteId, written only at creation (a page
    // never changes site) — needed for the slug uniqueness constraint and
    // for public resolution without a join, see
    // PageTranslationRepositoryPort.findByParentGroupAndLocaleSlug.
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    pageGroupId: uuid('page_group_id')
      .notNull()
      .references(() => pageGroups.id, { onDelete: 'cascade' }),
    // Denormalized from pageGroups.parentId, RESYNCED on every reparenting
    // of the group (in the same transaction — see the use case that moves a
    // PageGroup) across ALL of its translations. A sibling-scoped slug
    // uniqueness constraint cannot reference another table's column through
    // a join in Postgres — this denormalization is the price of keeping the
    // same strong DB-level guarantee that existed on pages.parentId, rather
    // than relying on an application check alone.
    parentGroupId: uuid('parent_group_id'),
    locale: text('locale').notNull(),
    slug: text('slug').notNull(),
    seoMeta: jsonb('seo_meta').notNull().default({}).$type<SeoMeta>(),
    // Override di SOLI campi `translatable`, chiavati per blocco — un
    // campo assente eredita il valore condiviso di pageGroups.content.
    // Ignorato quando isDiverged è true.
    fieldValues: jsonb('field_values')
      .notNull()
      .default({})
      .$type<FieldValueOverlay>(),
    status: pageTranslationStatusEnum('status').notNull(),
    // The frozen merge (structure plus this language's fieldValues, or
    // divergedContent when unlinked) as of the last publish() — the same
    // shape and the same consumer (public resolution) as yesterday's
    // pages.publishedContent.
    publishedSnapshot: jsonb('published_snapshot').$type<PageContent>(),
    // "Unlinks" it: when true, this translation no longer receives the
    // structural changes propagated from pageGroups.content — it has a
    // structure and text of its own in divergedContent.
    isDiverged: boolean('is_diverged').notNull().default(false),
    divergedContent: jsonb('diverged_content').$type<PageContent>(),
    // Plain extracted text (SearchPort's indexPage, see
    // @brisk/postgres-search-repository) — never read/written by
    // PageTranslationRepositoryPort itself, kept here only so it lives on
    // the same row a translation's other content does. `search_vector`
    // (tsvector, generated from this column) isn't modeled here at all:
    // Drizzle has no first-class generated-column DSL for it — see the
    // migration that added this column (Fase 5, replaces pages.searchText).
    searchText: text('search_text'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique().on(table.tenantId, table.pageGroupId, table.locale),
    // Sibling-scoped (the same scheme as pages above) but keyed on
    // parentGroupId rather than a per-locale parentId — see the comment on
    // the column. The same Postgres NULL <> NULL gap, closed the same way
    // by the partial index below.
    unique().on(
      table.tenantId,
      table.siteId,
      table.locale,
      table.parentGroupId,
      table.slug,
    ),
    uniqueIndex('page_translations_root_slug_unique')
      .on(table.tenantId, table.siteId, table.locale, table.slug)
      .where(sql`${table.parentGroupId} is null`),
    index('page_translations_tenant_group_idx').on(
      table.tenantId,
      table.pageGroupId,
    ),
  ],
);

export const pageGroupVersions = pgTable(
  'page_group_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pageGroupId: uuid('page_group_id')
      .notNull()
      .references(() => pageGroups.id, { onDelete: 'cascade' }),
    content: jsonb('content').notNull().$type<PageContent>(),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('page_group_versions_group_created_idx').on(
      table.pageGroupId,
      table.createdAt,
    ),
  ],
);

export const pageTranslationVersions = pgTable(
  'page_translation_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pageTranslationId: uuid('page_translation_id')
      .notNull()
      .references(() => pageTranslations.id, { onDelete: 'cascade' }),
    fieldValues: jsonb('field_values').notNull().$type<FieldValueOverlay>(),
    seoMeta: jsonb('seo_meta').notNull().$type<SeoMeta>(),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('page_translation_versions_translation_created_idx').on(
      table.pageTranslationId,
      table.createdAt,
    ),
  ],
);

// One header and one footer per (site, locale) at most (docs/adr/0018) —
// applied automatically around every page of that locale, never placed
// by hand on individual pages like Hero/Text/Image.
export const siteLayoutSections = pgTable(
  'site_layout_sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    kind: siteLayoutSectionKindEnum('kind').notNull(),
    status: siteLayoutSectionStatusEnum('status').notNull(),
    content: jsonb('content').notNull().default([]).$type<PageContent>(),
    publishedContent: jsonb('published_content').$type<PageContent>(),
    // Meaningful for kind='header' only (stays pinned to the top of the
    // viewport on scroll) — no DB-level constraint tying it to kind, same
    // reasoning as the domain entity's own comment on SiteLayoutSection.sticky.
    sticky: boolean('sticky').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique().on(table.tenantId, table.siteId, table.locale, table.kind),
    index('site_layout_sections_tenant_site_idx').on(
      table.tenantId,
      table.siteId,
    ),
  ],
);

export const siteLayoutSectionVersions = pgTable(
  'site_layout_section_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    siteLayoutSectionId: uuid('site_layout_section_id')
      .notNull()
      .references(() => siteLayoutSections.id, { onDelete: 'cascade' }),
    content: jsonb('content').notNull().$type<PageContent>(),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // every save creates a row here, never a destructive overwrite
  },
  (table) => [
    // Composite for the same reason as page_versions_page_created_idx
    // above: listing is always
    // `WHERE site_layout_section_id = ? ORDER BY created_at ASC`.
    index('site_layout_section_versions_section_created_idx').on(
      table.siteLayoutSectionId,
      table.createdAt,
    ),
  ],
);

export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    storageKey: text('storage_key').notNull(),
    storageProvider: storageProviderEnum('storage_provider').notNull(),
    mimeType: text('mime_type').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    width: integer('width'),
    height: integer('height'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('media_tenant_site_idx').on(table.tenantId, table.siteId)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // SHA-256 of the session token — the plaintext token is never persisted,
    // only ever held by the client cookie and checked in-flight. See
    // docs/adr/0010-session-based-auth-foundations.md.
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('sessions_user_idx').on(table.userId)],
);

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // one table, not two: both purposes share the exact same shape and
    // single-use/expiring lifecycle. See
    // docs/adr/0011-email-verification-password-reset.md.
    purpose: verificationTokenPurposeEnum('purpose').notNull(),
    // SHA-256 of the token — same reasoning as `sessions.token_hash`.
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('verification_tokens_user_idx').on(table.userId)],
);

export const forms = pgTable(
  'forms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Sole source of truth for both public rendering and submission
    // validation (docs/adr/0015) — no separate schema anywhere else.
    fields: jsonb('fields').notNull().default([]).$type<FormField[]>(),
    // Empty by default — a plain single-step form, same shape every form
    // had before this column existed (docs/adr/0015's multi-step follow-up).
    steps: jsonb('steps').notNull().default([]).$type<FormStep[]>(),
    notificationEmail: text('notification_email'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('forms_tenant_site_idx').on(table.tenantId, table.siteId)],
);

export const formSubmissions = pgTable(
  'form_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    // preserves history even if the page is later removed — i18n a livello
    // di campo (Fase 5): repointed from the old pages.id to
    // pageTranslations.id (nothing populates this column yet either way,
    // see apps/public-site's forms submit proxy).
    pageId: uuid('page_id').references(() => pageTranslations.id, {
      onDelete: 'set null',
    }),
    // preserves history even if the form is later deleted (docs/adr/0015)
    formId: uuid('form_id').references(() => forms.id, {
      onDelete: 'set null',
    }),
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('form_submissions_tenant_site_idx').on(table.tenantId, table.siteId),
  ],
);
