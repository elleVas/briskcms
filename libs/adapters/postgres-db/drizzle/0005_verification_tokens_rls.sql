-- RLS for `verification_tokens` — same pattern as 0003_sessions_rls.sql,
-- reusing current_tenant() from 0001_rls_and_grants.sql. Grants already
-- cover this table via the `alter default privileges` clause in 0001.

alter table verification_tokens enable row level security;
--> statement-breakpoint
alter table verification_tokens force row level security;
--> statement-breakpoint
create policy tenant_isolation on verification_tokens using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());
