-- One attempt at bringing a site in from somewhere else (docs/adr/0082).
--
-- The uploaded file is not stored: it is read once from disk and the row
-- keeps the report, which is kilobytes where an export is hundreds of
-- megabytes (314 MB on the first client site this was measured against).
CREATE TYPE "public"."import_job_status" AS ENUM('analyzing', 'analyzed', 'failed');
--> statement-breakpoint
CREATE TABLE "import_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "site_id" uuid NOT NULL,
  "source" text NOT NULL,
  "file_name" text NOT NULL,
  "file_bytes" integer NOT NULL,
  "status" "public"."import_job_status" DEFAULT 'analyzing' NOT NULL,
  "report" jsonb,
  "failure_reason" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "import_jobs_tenant_site_created_idx" ON "import_jobs" USING btree ("tenant_id","site_id","created_at");

-- Row Level Security, in the same guarded form as 0011 and 0012: `create
-- policy` has no `if not exists`, and a migration that cannot be re-run
-- on a database somebody already patched by hand is a migration that
-- will be run by hand instead.
--
-- A report names a site's pages and the plugins it runs. It is not
-- content, and it is exactly the kind of row whose leak nobody would
-- notice.
do $$
begin
  execute 'alter table import_jobs enable row level security';
  execute 'alter table import_jobs force row level security';
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'import_jobs' and policyname = 'tenant_isolation'
  ) then
    execute 'create policy tenant_isolation on import_jobs using (tenant_id = current_tenant()) with check (tenant_id = current_tenant())';
  end if;
end $$;
