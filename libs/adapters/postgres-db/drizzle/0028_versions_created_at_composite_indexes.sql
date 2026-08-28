DROP INDEX "page_versions_page_idx";--> statement-breakpoint
DROP INDEX "site_layout_section_versions_section_idx";--> statement-breakpoint
CREATE INDEX "page_versions_page_created_idx" ON "page_versions" USING btree ("page_id","created_at");--> statement-breakpoint
CREATE INDEX "site_layout_section_versions_section_created_idx" ON "site_layout_section_versions" USING btree ("site_layout_section_id","created_at");