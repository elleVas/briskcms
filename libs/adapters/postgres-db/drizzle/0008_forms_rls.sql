-- RLS for `forms` — same pattern as 0003_sessions_rls.sql /
-- 0005_verification_tokens_rls.sql, reusing current_tenant() from
-- 0001_rls_and_grants.sql. Grants already cover this table via the
-- `alter default privileges` clause in 0001.

alter table forms enable row level security;
--> statement-breakpoint
alter table forms force row level security;
--> statement-breakpoint
create policy tenant_isolation on forms using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());
