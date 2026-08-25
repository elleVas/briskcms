CREATE TABLE "site_theme_block_styles" (
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"block_type" text NOT NULL,
	"style" jsonb NOT NULL,
	CONSTRAINT "site_theme_block_styles_site_id_block_type_pk" PRIMARY KEY("site_id","block_type")
);
--> statement-breakpoint
ALTER TABLE "site_theme_block_styles" ADD CONSTRAINT "site_theme_block_styles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_theme_block_styles" ADD CONSTRAINT "site_theme_block_styles_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_theme_block_styles_tenant_site_idx" ON "site_theme_block_styles" USING btree ("tenant_id","site_id");