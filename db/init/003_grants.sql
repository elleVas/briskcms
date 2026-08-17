-- Privilegi minimi per il ruolo applicativo runtime (vedi 000_roles.sh).
-- Le policy RLS di 002_rls.sql sono ciò che isola i tenant: questi grant danno
-- solo l'accesso CRUD di base, la sicurezza per-riga resta demandata a RLS.

grant usage on schema public to brisk_app;
grant select, insert, update, delete on all tables in schema public to brisk_app;
alter default privileges in schema public
  grant select, insert, update, delete on tables to brisk_app;
