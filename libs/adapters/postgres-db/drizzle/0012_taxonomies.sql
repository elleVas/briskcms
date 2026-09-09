CREATE TABLE "page_group_terms" (
	"tenant_id" uuid NOT NULL,
	"page_group_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_group_terms_page_group_id_term_id_pk" PRIMARY KEY("page_group_id","term_id")
);
--> statement-breakpoint
CREATE TABLE "taxonomies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"slug" text,
	"name" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hierarchical" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "taxonomies_tenant_id_site_id_slug_unique" UNIQUE("tenant_id","site_id","slug")
);
--> statement-breakpoint
CREATE TABLE "term_slugs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"slug" text NOT NULL,
	"route_prefix" text,
	CONSTRAINT "term_slugs_tenant_id_term_id_locale_unique" UNIQUE("tenant_id","term_id","locale"),
	CONSTRAINT "term_slugs_route_unique" UNIQUE NULLS NOT DISTINCT("tenant_id","site_id","locale","route_prefix","slug")
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"taxonomy_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seo_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"landing_page_group_id" uuid,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "page_group_terms" ADD CONSTRAINT "page_group_terms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_group_terms" ADD CONSTRAINT "page_group_terms_page_group_id_page_groups_id_fk" FOREIGN KEY ("page_group_id") REFERENCES "public"."page_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_group_terms" ADD CONSTRAINT "page_group_terms_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomies" ADD CONSTRAINT "taxonomies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomies" ADD CONSTRAINT "taxonomies_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_slugs" ADD CONSTRAINT "term_slugs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_slugs" ADD CONSTRAINT "term_slugs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_slugs" ADD CONSTRAINT "term_slugs_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_taxonomy_id_taxonomies_id_fk" FOREIGN KEY ("taxonomy_id") REFERENCES "public"."taxonomies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_parent_id_terms_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."terms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_landing_page_group_id_page_groups_id_fk" FOREIGN KEY ("landing_page_group_id") REFERENCES "public"."page_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_group_terms_term_idx" ON "page_group_terms" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "taxonomies_tenant_site_idx" ON "taxonomies" USING btree ("tenant_id","site_id");--> statement-breakpoint
CREATE INDEX "term_slugs_lookup_idx" ON "term_slugs" USING btree ("tenant_id","site_id","locale","slug");--> statement-breakpoint
CREATE INDEX "terms_tenant_site_idx" ON "terms" USING btree ("tenant_id","site_id");--> statement-breakpoint
CREATE INDEX "terms_taxonomy_parent_order_idx" ON "terms" USING btree ("taxonomy_id","parent_id","order");--> statement-breakpoint
CREATE UNIQUE INDEX "terms_landing_page_group_unique" ON "terms" USING btree ("landing_page_group_id") WHERE "terms"."landing_page_group_id" is not null;

-- Row Level Security for the four new tenant-scoped tables, in the same
-- guarded form as 0011: `create policy` has no `if not exists`, and a
-- migration that cannot be re-run on a database somebody already patched
-- by hand is a migration that will be run by hand instead.
--
-- `page_group_terms` carries a `tenant_id` it could have reached through
-- either of its two foreign keys, and this is why: without a column of
-- its own it cannot have a policy, and the join table is exactly where a
-- missing policy would be least visible — a row that says "this page is
-- in that category" leaks both facts.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'taxonomies', 'terms', 'term_slugs', 'page_group_terms'
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
