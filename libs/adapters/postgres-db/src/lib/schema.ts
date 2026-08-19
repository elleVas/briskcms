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
  OpeningHoursDay,
  PageContent,
  SeoMeta,
  UntranslatedPageFallback,
} from '@brisk/shared-types';
import type {
  PageStatus,
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
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull().$type<UserRole>(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique().on(table.tenantId, table.email),
    check('users_role_check', sql`${table.role} in ('admin', 'editor')`),
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
      sql`${table.purpose} in ('email-verification', 'password-reset')`,
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
