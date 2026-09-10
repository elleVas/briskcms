CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'newspaper' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "page_groups" ADD COLUMN "collection_id" uuid;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collections_tenant_site_idx" ON "collections" USING btree ("tenant_id","site_id");--> statement-breakpoint
ALTER TABLE "page_groups" ADD CONSTRAINT "page_groups_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;

-- Row Level Security, in the same guarded form as 0011 and 0012:
-- `create policy` has no `if not exists`, and a migration that cannot be
-- re-run on a database somebody already patched by hand is a migration
-- that will be run by hand instead.
do $$
begin
  execute 'alter table collections enable row level security';
  execute 'alter table collections force row level security';
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'collections' and policyname = 'tenant_isolation'
  ) then
    execute
      'create policy tenant_isolation on collections using (tenant_id = current_tenant()) with check (tenant_id = current_tenant())';
  end if;
end $$;
