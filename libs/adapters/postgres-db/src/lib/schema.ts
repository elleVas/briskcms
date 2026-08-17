import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import type { PageContent, SeoMeta } from '@brisk/shared-types';
import type { PageStatus, StorageProvider, UserRole } from '@brisk/domain-core';

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

export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  domain: text('domain'),
  defaultLocale: text('default_locale').notNull(),
  enabledLocales: text('enabled_locales').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('form_submissions_tenant_site_idx').on(table.tenantId, table.siteId),
  ],
);
