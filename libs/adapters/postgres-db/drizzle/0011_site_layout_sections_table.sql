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
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_content" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_layout_sections_tenant_id_site_id_locale_kind_unique" UNIQUE("tenant_id","site_id","locale","kind"),
	CONSTRAINT "site_layout_sections_kind_check" CHECK ("site_layout_sections"."kind" in ('header', 'footer')),
	CONSTRAINT "site_layout_sections_status_check" CHECK ("site_layout_sections"."status" in ('draft', 'published'))
);
--> statement-breakpoint
ALTER TABLE "site_layout_section_versions" ADD CONSTRAINT "site_layout_section_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_layout_section_versions" ADD CONSTRAINT "site_layout_section_versions_site_layout_section_id_site_layout_sections_id_fk" FOREIGN KEY ("site_layout_section_id") REFERENCES "public"."site_layout_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_layout_section_versions" ADD CONSTRAINT "site_layout_section_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_layout_sections" ADD CONSTRAINT "site_layout_sections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_layout_sections" ADD CONSTRAINT "site_layout_sections_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_layout_section_versions_section_idx" ON "site_layout_section_versions" USING btree ("site_layout_section_id");--> statement-breakpoint
CREATE INDEX "site_layout_sections_tenant_site_idx" ON "site_layout_sections" USING btree ("tenant_id","site_id");