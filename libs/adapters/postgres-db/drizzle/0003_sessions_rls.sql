-- RLS for `sessions`, added after the initial rollout — see
-- 0001_rls_and_grants.sql for the original policy shape and the
-- current_tenant() function reused here. Grants already cover this table via
-- the `alter default privileges` clause in 0001 (this migration runs as the
-- same admin role that ran that ALTER), so only RLS enable+policy is needed.

alter table sessions enable row level security;
--> statement-breakpoint
alter table sessions force row level security;
--> statement-breakpoint
create policy tenant_isolation on sessions using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());
