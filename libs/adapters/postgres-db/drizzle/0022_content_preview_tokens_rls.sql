-- RLS for `content_preview_tokens`, added after the initial rollout — same
-- pattern as 0003_sessions_rls.sql, reusing current_tenant() from
-- 0001_rls_and_grants.sql. Grants already cover this table via the
-- `alter default privileges` clause in 0001 (this migration runs as the
-- same admin role that ran that ALTER), so only RLS enable+policy is needed.

alter table content_preview_tokens enable row level security;
--> statement-breakpoint
alter table content_preview_tokens force row level security;
--> statement-breakpoint
create policy tenant_isolation on content_preview_tokens using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());
