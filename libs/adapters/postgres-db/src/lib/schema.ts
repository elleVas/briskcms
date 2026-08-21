import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import type {
  FormField,
  FormStep,
  OpeningHoursDay,
  PageContent,
  SeoMeta,
  ThemeTokens,
  UntranslatedPageFallback,
} from '@brisk/shared-types';
import type {
  PageStatus,
  PreviewContentType,
  SiteLayoutSectionKind,
  SiteLayoutSectionStatus,
  StorageProvider,
  UserRole,
  VerificationTokenPurpose,
} from '@brisk/domain-core';

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
    role: text('role').notNull().$type<UserRole>(),
    // False for a freshly-invited user who hasn't accepted yet, or an
    // admin-deactivated one — see the domain entity's own doc comment.
    isActive: boolean('is_active').notNull().default(true),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique().on(table.tenantId, table.email),
    check(
      'users_role_check',
      sql`${table.role} in ('admin', 'publisher', 'editor')`,
    ),
  ],
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
    untranslatedPageFallback: text('untranslated_page_fallback')
      .notNull()
      .default('redirect-to-default')
      .$type<UntranslatedPageFallback>(),
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
    // Fase 2a del piano editor visuale, parte 2 (Global Styles Editor) —
    // categorie di stile oltre ai colori (Bottoni oggi). Nullable come il
    // resto di Tier 1: `null` = nessuna categoria personalizzata ancora.
    themeTokens: jsonb('theme_tokens').$type<ThemeTokens>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'sites_untranslated_page_fallback_check',
      sql`${table.untranslatedPageFallback} in ('redirect-to-default', 'not-available')`,
    ),
  ],
);

export const pages = pgTable(
  'pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    // links the translations of the same page together
    groupId: uuid('group_id').notNull(),
    locale: text('locale').notNull(),
    slug: text('slug').notNull(),
    // Self-reference (page hierarchy, WP-style) — nullable, no cascade: a
    // deleted parent orphans its children (parentId -> null) rather than
    // deleting the whole subtree, matching how WordPress treats
    // post_parent on delete.
    parentId: uuid('parent_id').references((): AnyPgColumn => pages.id, {
      onDelete: 'set null',
    }),
    status: text('status').notNull().$type<PageStatus>(),
    // latest draft (Puck content format)
    content: jsonb('content').notNull().default([]).$type<PageContent>(),
    // last actually published version
    publishedContent: jsonb('published_content').$type<PageContent>(),
    // title, description, og tags, canonical
    seoMeta: jsonb('seo_meta').notNull().default({}).$type<SeoMeta>(),
    // Plain extracted text (SearchPort's indexPage, see
    // @brisk/postgres-search-repository) — never read/written by
    // PageRepositoryPort itself, kept here only so it lives on the same
    // row a page's other content does. `search_vector` (tsvector,
    // generated from this column) isn't modeled here at all: Drizzle has
    // no first-class generated-column DSL for it, and nothing in this
    // package ever needs to read/write it directly — see
    // drizzle/0016_pages_search_vector.sql.
    searchText: text('search_text'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique().on(table.tenantId, table.siteId, table.groupId, table.locale),
    unique().on(table.tenantId, table.siteId, table.locale, table.slug),
    check('pages_status_check', sql`${table.status} in ('draft', 'published')`),
    index('pages_tenant_site_idx').on(table.tenantId, table.siteId),
  ],
);

export const pageVersions = pgTable(
  'page_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    content: jsonb('content').notNull().$type<PageContent>(),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // every save creates a row here, never a destructive overwrite
  },
  (table) => [index('page_versions_page_idx').on(table.pageId)],
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
    kind: text('kind').notNull().$type<SiteLayoutSectionKind>(),
    status: text('status').notNull().$type<SiteLayoutSectionStatus>(),
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
    check(
      'site_layout_sections_kind_check',
      sql`${table.kind} in ('header', 'footer')`,
    ),
    check(
      'site_layout_sections_status_check',
      sql`${table.status} in ('draft', 'published')`,
    ),
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
    index('site_layout_section_versions_section_idx').on(
      table.siteLayoutSectionId,
    ),
  ],
);

// Un token per (contentType, contentId) alla volta è ammesso — nessun
// vincolo di unicità: creare un nuovo token per lo stesso contenuto non
// invalida quelli già emessi (non-consumante, vedi PreviewTokenPort). Niente
// FK su `contentId`: punta a `pages.id` o `site_layout_sections.id` a
// seconda di `contentType` (associazione polimorfica), le due tabelle non
// condividono una chiave comune su cui appoggiare un singolo vincolo FK.
export const contentPreviewTokens = pgTable(
  'content_preview_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contentType: text('content_type').notNull().$type<PreviewContentType>(),
    contentId: uuid('content_id').notNull(),
    // SHA-256 del token opaco — stesso trattamento di sessions/verification_tokens.
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'content_preview_tokens_content_type_check',
      sql`${table.contentType} in ('page', 'header', 'footer')`,
    ),
    index('content_preview_tokens_content_idx').on(
      table.contentType,
      table.contentId,
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
    storageProvider: text('storage_provider')
      .notNull()
      .$type<StorageProvider>(),
    mimeType: text('mime_type').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    width: integer('width'),
    height: integer('height'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'media_storage_provider_check',
      sql`${table.storageProvider} in ('local', 's3')`,
    ),
    index('media_tenant_site_idx').on(table.tenantId, table.siteId),
  ],
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
    purpose: text('purpose').notNull().$type<VerificationTokenPurpose>(),
    // SHA-256 of the token — same reasoning as `sessions.token_hash`.
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'verification_tokens_purpose_check',
      sql`${table.purpose} in ('email-verification', 'password-reset', 'user-invite')`,
    ),
    index('verification_tokens_user_idx').on(table.userId),
  ],
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
    // preserves history even if the page is later removed
    pageId: uuid('page_id').references(() => pages.id, {
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
