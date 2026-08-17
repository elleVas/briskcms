# 0002 — Ruolo Postgres non-superuser dedicato per l'app

**Stato**: Accettata — 2026-08-17

## Contesto

Lo schema iniziale (`db/init/001_schema.sql`) attiva Row Level Security con
`FORCE ROW LEVEL SECURITY` su ogni tabella con `tenant_id`, con policy
`tenant_id = current_tenant()`. Un test manuale con due tenant, connesso come
l'utente Postgres di default (creato da `POSTGRES_USER` nell'immagine ufficiale
`postgres`), ha mostrato che **entrambi i tenant vedevano tutte le righe** —
l'isolamento non funzionava.

Causa: quell'utente è un superuser Postgres. I superuser bypassano sempre la Row
Level Security, indipendentemente da `FORCE ROW LEVEL SECURITY` — quella clausola
vale solo per il proprietario della tabella quando *non* è superuser.

## Decisione

`db/init/000_roles.sh` crea un ruolo applicativo dedicato `brisk_app`, non-superuser,
senza `BYPASSRLS`, con soli i privilegi CRUD di base (`db/init/003_grants.sql`).
Il backend si connette **sempre** come `brisk_app` per le query runtime. Il ruolo
`POSTGRES_USER`/superuser è riservato a migration e task di amministrazione.

Verificato manualmente: connesso come `brisk_app`, un tenant non vede mai le righe
di un altro; senza `app.current_tenant_id` impostato in sessione, la visibilità è
zero (fail-closed).

## Conseguenze

- Ogni adapter Postgres (`libs/adapters/postgres-page-repository`, e i futuri) deve
  usare la connection string con `brisk_app`, mai quella admin — da documentare
  esplicitamente nel setup di ogni adapter e da verificare in code review.
- Le migration (Fase 1+, Drizzle) girano invece con l'utente admin/superuser, perché
  devono poter creare ruoli/policy/estensioni che `brisk_app` non ha il permesso di
  creare.
- Qualunque nuova tabella con `tenant_id` deve ricevere gli stessi grant verso
  `brisk_app` in `003_grants.sql` (o nella migration Drizzle equivalente), altrimenti
  l'app riceve errori di permessi invece di un semplice filtro RLS.
