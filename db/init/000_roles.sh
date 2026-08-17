#!/bin/bash
# POSTGRES_USER (superuser, creato da initdb) bypassa SEMPRE RLS — va usato solo
# per le migration/admin, mai per le query runtime dell'app. Creiamo qui un ruolo
# applicativo dedicato, non-superuser, che rispetta le policy RLS.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  do \$\$
  begin
    if not exists (select from pg_roles where rolname = 'brisk_app') then
      create role brisk_app login password '${POSTGRES_APP_PASSWORD}';
    end if;
  end
  \$\$;
EOSQL
