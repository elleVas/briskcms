CREATE TYPE "public"."page_translation_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "page_group_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"page_group_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"parent_id" uuid,
	"content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_translation_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"page_translation_id" uuid NOT NULL,
	"field_values" jsonb NOT NULL,
	"seo_meta" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"page_group_id" uuid NOT NULL,
	"parent_group_id" uuid,
	"locale" text NOT NULL,
	"slug" text NOT NULL,
	"seo_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"field_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "page_translation_status" NOT NULL,
	"published_snapshot" jsonb,
	"is_diverged" boolean DEFAULT false NOT NULL,
	"diverged_content" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_translations_tenant_id_page_group_id_locale_unique" UNIQUE("tenant_id","page_group_id","locale"),
	CONSTRAINT "page_translations_tenant_id_site_id_locale_parent_group_id_slug_unique" UNIQUE("tenant_id","site_id","locale","parent_group_id","slug")
);
--> statement-breakpoint
ALTER TABLE "page_group_versions" ADD CONSTRAINT "page_group_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_group_versions" ADD CONSTRAINT "page_group_versions_page_group_id_page_groups_id_fk" FOREIGN KEY ("page_group_id") REFERENCES "public"."page_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_group_versions" ADD CONSTRAINT "page_group_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_groups" ADD CONSTRAINT "page_groups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_groups" ADD CONSTRAINT "page_groups_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_groups" ADD CONSTRAINT "page_groups_parent_id_page_groups_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."page_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_groups" ADD CONSTRAINT "page_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_translation_versions" ADD CONSTRAINT "page_translation_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_translation_versions" ADD CONSTRAINT "page_translation_versions_page_translation_id_page_translations_id_fk" FOREIGN KEY ("page_translation_id") REFERENCES "public"."page_translations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_translation_versions" ADD CONSTRAINT "page_translation_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_translations" ADD CONSTRAINT "page_translations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_translations" ADD CONSTRAINT "page_translations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_translations" ADD CONSTRAINT "page_translations_page_group_id_page_groups_id_fk" FOREIGN KEY ("page_group_id") REFERENCES "public"."page_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_translations" ADD CONSTRAINT "page_translations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_group_versions_group_created_idx" ON "page_group_versions" USING btree ("page_group_id","created_at");--> statement-breakpoint
CREATE INDEX "page_groups_tenant_site_idx" ON "page_groups" USING btree ("tenant_id","site_id");--> statement-breakpoint
CREATE INDEX "page_translation_versions_translation_created_idx" ON "page_translation_versions" USING btree ("page_translation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "page_translations_root_slug_unique" ON "page_translations" USING btree ("tenant_id","site_id","locale","slug") WHERE "page_translations"."parent_group_id" is null;--> statement-breakpoint
CREATE INDEX "page_translations_tenant_group_idx" ON "page_translations" USING btree ("tenant_id","page_group_id");