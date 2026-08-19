-- RLS for `site_layout_sections` / `site_layout_section_versions` — same
-- pattern as 0008_forms_rls.sql, reusing current_tenant() from
-- 0001_rls_and_grants.sql. Grants already cover these tables via the
-- `alter default privileges` clause in 0001.

alter table site_layout_sections enable row level security;
--> statement-breakpoint
alter table site_layout_sections force row level security;
--> statement-breakpoint
create policy tenant_isolation on site_layout_sections using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());
--> statement-breakpoint
alter table site_layout_section_versions enable row level security;
--> statement-breakpoint
alter table site_layout_section_versions force row level security;
--> statement-breakpoint
create policy tenant_isolation on site_layout_section_versions using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());
