-- Row Level Security — attiva da subito anche in single-tenant, con policy banale.
-- L'app imposta la sessione con: select set_config('app.current_tenant_id', '<uuid>', false);

create or replace function current_tenant() returns uuid as $$
  select nullif(current_setting('app.current_tenant_id', true), '')::uuid
$$ language sql stable;

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
