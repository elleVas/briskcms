CREATE TYPE "public"."page_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."site_layout_section_kind" AS ENUM('header', 'footer');--> statement-breakpoint
CREATE TYPE "public"."site_layout_section_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."storage_provider" AS ENUM('local', 's3');--> statement-breakpoint
CREATE TYPE "public"."untranslated_page_fallback" AS ENUM('redirect-to-default', 'not-available');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'publisher', 'editor');--> statement-breakpoint
CREATE TYPE "public"."verification_token_purpose" AS ENUM('email-verification', 'password-reset', 'user-invite');--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"page_id" uuid,
	"form_id" uuid,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"name" text NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notification_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"storage_provider" "storage_provider" NOT NULL,
	"mime_type" text NOT NULL,
	"size" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"slug" text NOT NULL,
	"parent_id" uuid,
	"status" "page_status" NOT NULL,
	"content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_content" jsonb,
	"seo_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"search_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pages_tenant_id_site_id_group_id_locale_unique" UNIQUE("tenant_id","site_id","group_id","locale"),
	CONSTRAINT "pages_tenant_id_site_id_locale_parent_id_slug_unique" UNIQUE("tenant_id","site_id","locale","parent_id","slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "site_layout_section_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_layout_section_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_layout_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"kind" "site_layout_section_kind" NOT NULL,
	"status" "site_layout_section_status" NOT NULL,
	"content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_content" jsonb,
	"sticky" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_layout_sections_tenant_id_site_id_locale_kind_unique" UNIQUE("tenant_id","site_id","locale","kind")
);
--> statement-breakpoint
CREATE TABLE "site_theme_block_styles" (
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"block_type" text NOT NULL,
	"style" jsonb NOT NULL,
	CONSTRAINT "site_theme_block_styles_site_id_block_type_pk" PRIMARY KEY("site_id","block_type")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"default_locale" text NOT NULL,
	"enabled_locales" text[] DEFAULT '{}' NOT NULL,
	"untranslated_page_fallback" "untranslated_page_fallback" DEFAULT 'redirect-to-default' NOT NULL,
	"business_address" text,
	"business_phone" text,
	"business_type" text,
	"opening_hours" jsonb,
	"search_engine_indexing_enabled" boolean DEFAULT false NOT NULL,
	"theme_primary_color" text,
	"theme_secondary_color" text,
	"theme_font_family" text,
	"theme_custom_css" text,
	"theme_head_script" text,
	"theme_body_script" text,
	"theme_favicon_url" text,
	"theme_overrides_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_tenant_id_domain_unique" UNIQUE("tenant_id","domain")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_tenant_id_email_unique" UNIQUE("tenant_id","email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "verification_token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_layout_section_versions" ADD CONSTRAINT "site_layout_section_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_layout_section_versions" ADD CONSTRAINT "site_layout_section_versions_site_layout_section_id_site_layout_sections_id_fk" FOREIGN KEY ("site_layout_section_id") REFERENCES "public"."site_layout_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_layout_section_versions" ADD CONSTRAINT "site_layout_section_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_layout_sections" ADD CONSTRAINT "site_layout_sections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_layout_sections" ADD CONSTRAINT "site_layout_sections_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_theme_block_styles" ADD CONSTRAINT "site_theme_block_styles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_theme_block_styles" ADD CONSTRAINT "site_theme_block_styles_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_submissions_tenant_site_idx" ON "form_submissions" USING btree ("tenant_id","site_id");--> statement-breakpoint
CREATE INDEX "forms_tenant_site_idx" ON "forms" USING btree ("tenant_id","site_id");--> statement-breakpoint
CREATE INDEX "media_tenant_site_idx" ON "media" USING btree ("tenant_id","site_id");--> statement-breakpoint
CREATE INDEX "page_versions_page_created_idx" ON "page_versions" USING btree ("page_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_root_slug_unique" ON "pages" USING btree ("tenant_id","site_id","locale","slug") WHERE "pages"."parent_id" is null;--> statement-breakpoint
CREATE INDEX "pages_tenant_site_idx" ON "pages" USING btree ("tenant_id","site_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "site_layout_section_versions_section_created_idx" ON "site_layout_section_versions" USING btree ("site_layout_section_id","created_at");--> statement-breakpoint
CREATE INDEX "site_layout_sections_tenant_site_idx" ON "site_layout_sections" USING btree ("tenant_id","site_id");--> statement-breakpoint
CREATE INDEX "site_theme_block_styles_tenant_site_idx" ON "site_theme_block_styles" USING btree ("tenant_id","site_id");--> statement-breakpoint
CREATE INDEX "verification_tokens_user_idx" ON "verification_tokens" USING btree ("user_id");--> statement-breakpoint
-- Generated column, not modeled in schema.ts (Drizzle has no first-class
-- DSL for tsvector/generated columns) — SearchPort's Postgres adapter
-- writes plain text to `search_text` (a normal Drizzle column); Postgres
-- derives `search_vector` from it automatically on every write. Carried
-- forward verbatim from the pre-squash 0017_pages_search_vector.sql.
ALTER TABLE "pages" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('italian', coalesce("search_text", ''))) STORED;
--> statement-breakpoint
CREATE INDEX "pages_search_vector_idx" ON "pages" USING GIN ("search_vector");
--> statement-breakpoint

-- Row Level Security, enabled from day one even in single-tenant mode, with a
-- deliberately trivial policy. The app sets the session with:
--   select set_config('app.current_tenant_id', '<uuid>', true);
-- (transaction-local, not session-wide — safe under connection pooling.)
--
-- Assumes the `brisk_app` role already exists (created by db/init/000_roles.sh,
-- which still runs on container init since it needs a secret from the
-- environment that a checked-in migration file can't hold).
--
-- See docs/adr/0002-non-superuser-role-for-rls-enforcement.md: this only
-- protects anything because migrations run as a superuser/table-owner that is
-- NOT the same role the app connects as — superusers always bypass RLS.
--
-- Carried forward verbatim (extended to cover every tenant-scoped table
-- that existed pre-squash, across 0001/0003/0005/0008/0012/0025_*rls*.sql)
-- from the pre-squash migration history — `tenants` itself is deliberately
-- excluded, it IS the tenant boundary, not scoped by one.
create or replace function current_tenant() returns uuid as $$
  select nullif(current_setting('app.current_tenant_id', true), '')::uuid
$$ language sql stable;
--> statement-breakpoint

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'users', 'sites', 'pages', 'page_versions', 'media', 'form_submissions',
    'sessions', 'verification_tokens', 'forms', 'site_layout_sections',
    'site_layout_section_versions', 'site_theme_block_styles'
  ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (tenant_id = current_tenant()) with check (tenant_id = current_tenant())',
      t
    );
  end loop;
end $$;
--> statement-breakpoint

grant usage on schema public to brisk_app;
--> statement-breakpoint
grant select, insert, update, delete on all tables in schema public to brisk_app;
--> statement-breakpoint
alter default privileges in schema public
  grant select, insert, update, delete on tables to brisk_app;