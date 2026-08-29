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
  FormField,
  FormStep,
  OpeningHoursDay,
  PageContent,
  SeoMeta,
  TrackerDomainEntry,
} from '@brisk/shared-types';

// One native Postgres enum type per domain string-union, matching the
// literal values of the corresponding domain-core/shared-types type
// exactly — kept separate even where two enums share the same value set
// (pageStatusEnum/siteLayoutSectionStatusEnum both 'draft'|'published')
// because their domain types are deliberately distinct (Page vs.
// SiteLayoutSection), see db-schema-cleanup-deferred-2026-08-28 memory.
export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'publisher',
  'editor',
]);
export const untranslatedPageFallbackEnum = pgEnum(
  'untranslated_page_fallback',
  ['redirect-to-default', 'not-available'],
);
export const pageStatusEnum = pgEnum('page_status', ['draft', 'published']);
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
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // findByDomain() è l'hot path di ogni richiesta pubblica (rendering
    // pagina, sitemap, ricerca, chrome del sito) — senza questo indice fa
    // scan sequenziale. Il vincolo UNIQUE che lo porta con sé è la parte
    // più importante: senza, due siti dello stesso tenant potrebbero avere
    // lo stesso domain (nulla lo impedisce a livello applicativo), e
    // findByDomain (che usa .limit(1) senza ORDER BY) servirebbe uno dei
    // due in modo indeterminato. `domain` resta nullable — Postgres tratta
    // più NULL come sempre distinti tra loro sotto UNIQUE, quindi più siti
    // dello stesso tenant senza ancora un dominio configurato coesistono
    // senza conflitto.
    unique().on(table.tenantId, table.domain),
  ],
);

/**
 * Sostituisce `sites.theme_tokens` (era un'unica mappa JSONB sparsa sulla
 * riga del sito) — una riga per (site, tipo di blocco) invece di una voce
 * annidata in un blob. Non per correttezza (l'`UPDATE ... jsonb_set`
 * precedente era già atomico per-tipo) ma per due motivi reali: una
 * scrittura qui non riscrive più l'intera riga larga `sites` sotto MVCC
 * (nome, dominio, impostazioni SEO, ecc. — tutte estranee allo stile), e
 * `WHERE block_type = 'Button'` diventa una lookup su indice normale
 * invece di una traversata di path JSONB. `style` resta jsonb (non
 * colonne tipizzate per proprietà): aggiungere/rimuovere una proprietà
 * stilabile resta un cambio di dato, non una migrazione — lo stesso
 * motivo per cui `blockStyles` era già una mappa generica.
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
    status: pageStatusEnum('status').notNull(),
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
    // Translation structural-drift indicator — the block-structure
    // signature (see @brisk/shared-types' content-structure-signature.ts)
    // this page's content was last confirmed aligned to. `null` for a
    // page never tracked under this mechanism.
    syncedStructureSignature: text('synced_structure_signature'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique().on(table.tenantId, table.siteId, table.groupId, table.locale),
    // Sibling-scoped (WP-style): the same slug can exist twice under
    // different parents (docs/adr — page hierarchy slug scoping). This
    // composite alone does NOT stop two ROOT-level pages (parent_id NULL)
    // from sharing a slug — Postgres treats NULL <> NULL, so a plain
    // unique constraint including a nullable column never fires when
    // that column is null on both rows. The partial index right below
    // closes exactly that gap.
    unique().on(
      table.tenantId,
      table.siteId,
      table.locale,
      table.parentId,
      table.slug,
    ),
    uniqueIndex('pages_root_slug_unique')
      .on(table.tenantId, table.siteId, table.locale, table.slug)
      .where(sql`${table.parentId} is null`),
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
  (table) => [
    // Composite, not just on pageId: every listing query is
    // `WHERE page_id = ? ORDER BY created_at ASC` (see
    // drizzle-page-version.repository.ts) — a pageId-only index still
    // needs a separate sort step, this one serves the query as a pure
    // index scan. The pageId-only lookups (if any) are still served by
    // this index's leading column.
    index('page_versions_page_created_idx').on(table.pageId, table.createdAt),
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
