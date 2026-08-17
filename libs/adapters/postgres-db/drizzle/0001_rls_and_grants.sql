-- Row Level Security, enabled from day one even in single-tenant mode, with a
-- deliberately trivial policy. The app sets the session with:
--   select set_config('app.current_tenant_id', '<uuid>', true);
-- (transaction-local, not session-wide — safe under connection pooling.)
--
-- Assumes the `brisk_app` role already exists (created by db/init/000_roles.sh,
-- which still runs on container init since it needs a secret from the
-- environment that a checked-in migration file can't hold).
--
-- See docs/adr/0002-non-superuser-role-for-rls-enforcement.md: this only
-- protects anything because migrations run as a superuser/table-owner that is
-- NOT the same role the app connects as — superusers always bypass RLS.

create or replace function current_tenant() returns uuid as $$
  select nullif(current_setting('app.current_tenant_id', true), '')::uuid
$$ language sql stable;
--> statement-breakpoint

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'users', 'sites', 'pages', 'page_versions', 'media', 'form_submissions'
  ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (tenant_id = current_tenant()) with check (tenant_id = current_tenant())',
      t
    );
  end loop;
end $$;
--> statement-breakpoint

grant usage on schema public to brisk_app;
--> statement-breakpoint
grant select, insert, update, delete on all tables in schema public to brisk_app;
--> statement-breakpoint
alter default privileges in schema public
  grant select, insert, update, delete on tables to brisk_app;
