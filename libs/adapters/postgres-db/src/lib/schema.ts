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

// i18n a livello di campo (struttura condivisa + override per-locale) —
// pageGroups/pageTranslations hanno sostituito la vecchia `pages`
// (rimossa in Fase 5 del piano). Un PageGroup possiede la struttura
// CONDIVISA tra tutte le lingue; una PageTranslation possiede il testo
// per-locale.
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
    // Gerarchia CONDIVISA tra tutte le lingue — a differenza della vecchia
    // pages.parentId (per-locale), non ha senso che due lingue della
    // stessa pagina vivano in punti diversi dell'albero del sito.
    parentId: uuid('parent_id').references((): AnyPgColumn => pageGroups.id, {
      onDelete: 'set null',
    }),
    // L'albero blocchi canonico — per un campo marcato `translatable`
    // (FieldDescriptor in @brisk/block-registry), il valore qui è quello
    // della lingua di default del sito, fallback quando una
    // pageTranslation non ha ancora un proprio override (vedi
    // mergeTranslatedContent in @brisk/shared-types).
    content: jsonb('content').notNull().default([]).$type<PageContent>(),
    // Sibling-scoped, condiviso per lo stesso motivo di parentId — stessa
    // non-unicità a livello DB della vecchia pages.order (un duplicato
    // temporaneo a metà riordino è innocuo, vedi reorderSiblingPages).
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
    // Denormalizzato da pageGroups.siteId, scritto solo alla creazione
    // (una pagina non cambia mai sito) — serve per il vincolo di
    // unicità dello slug e per la risoluzione pubblica senza un join,
    // vedi PageTranslationRepositoryPort.findByParentGroupAndLocaleSlug.
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    pageGroupId: uuid('page_group_id')
      .notNull()
      .references(() => pageGroups.id, { onDelete: 'cascade' }),
    // Denormalizzato da pageGroups.parentId, RI-SINCRONIZZATO su ogni
    // riparento del gruppo (stessa transazione — vedi il use-case che
    // sposta un PageGroup) su OGNI sua traduzione. Un vincolo di unicità
    // dello slug sibling-scoped non può referenziare una colonna di
    // un'altra tabella via join in Postgres — questa denormalizzazione è
    // il prezzo per mantenere la stessa garanzia forte a livello DB che
    // esisteva su pages.parentId, invece di affidarsi solo a un controllo
    // applicativo.
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
    // Merge congelato (struttura + fieldValues di questa lingua, o
    // divergedContent se scollegata) all'ultima publish() — stessa forma
    // e stesso consumatore (risoluzione pubblica) di pages.publishedContent
    // di ieri.
    publishedSnapshot: jsonb('published_snapshot').$type<PageContent>(),
    // Lo "scollega": quando true, questa traduzione non riceve più le
    // modifiche strutturali propagate da pageGroups.content — ha una
    // propria struttura+testo indipendente in divergedContent.
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
    // Sibling-scoped (stesso schema di pages sopra) ma chiavato su
    // parentGroupId invece di parentId per-locale — vedi il commento sulla
    // colonna. Stesso gap NULL <> NULL di Postgres, stessa chiusura via
    // indice parziale sotto.
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
