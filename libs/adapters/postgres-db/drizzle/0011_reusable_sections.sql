CREATE TYPE "public"."reusable_section_kind" AS ENUM('shared', 'template');--> statement-breakpoint
CREATE TYPE "public"."reusable_section_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "reusable_section_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reusable_section_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reusable_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "reusable_section_kind" NOT NULL,
	"status" "reusable_section_status" NOT NULL,
	"content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_content" jsonb,
	"exposed_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reusable_sections_tenant_id_site_id_name_unique" UNIQUE("tenant_id","site_id","name")
);
--> statement-breakpoint
ALTER TABLE "reusable_section_versions" ADD CONSTRAINT "reusable_section_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reusable_section_versions" ADD CONSTRAINT "reusable_section_versions_reusable_section_id_reusable_sections_id_fk" FOREIGN KEY ("reusable_section_id") REFERENCES "public"."reusable_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reusable_section_versions" ADD CONSTRAINT "reusable_section_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reusable_sections" ADD CONSTRAINT "reusable_sections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reusable_sections" ADD CONSTRAINT "reusable_sections_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reusable_sections" ADD CONSTRAINT "reusable_sections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reusable_section_versions_section_created_idx" ON "reusable_section_versions" USING btree ("reusable_section_id","created_at");--> statement-breakpoint
CREATE INDEX "reusable_sections_tenant_site_idx" ON "reusable_sections" USING btree ("tenant_id","site_id");--> statement-breakpoint

-- Row Level Security for the two new tenant-scoped tables, and for four
-- that have been missing it since 0004.
--
-- `page_groups`, `page_translations` and their two version tables were
-- created by the i18n rework and never added to the baseline's RLS loop —
-- verified against a live database, all four came back
-- `relrowsecurity=false, policies=0`. They hold every page's content, so
-- until now the application's own `withTenant` filter was the ONLY thing
-- keeping one tenant's pages away from another, which is exactly the
-- single point of failure docs/adr/0002 exists to avoid. Fixed here rather
-- than in a migration of its own because it is the same statement, on the
-- same day, for the same reason as the new tables' own policy — splitting
-- it would mean shipping a table with a policy next to four without one.
--
-- Guarded, not bare: `create policy` has no `if not exists`, and a
-- migration that cannot be re-run on a database somebody already patched
-- by hand is a migration that will be run by hand instead.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'reusable_sections', 'reusable_section_versions',
    'page_groups', 'page_translations',
    'page_group_versions', 'page_translation_versions'
  ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = 'tenant_isolation'
    ) then
      execute format(
        'create policy tenant_isolation on %I using (tenant_id = current_tenant()) with check (tenant_id = current_tenant())',
        t
      );
    end if;
  end loop;
end $$;
