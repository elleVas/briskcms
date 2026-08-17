# Sviluppo locale

## Prerequisiti

- Node.js 22+
- pnpm (`corepack enable` o `npm i -g pnpm`)
- Docker (per Postgres locale)

## Setup

```sh
cp .env.example .env
docker compose up -d postgres
pnpm install
```

`docker compose up -d postgres` esegue automaticamente gli script in `db/init/`
(solo alla prima creazione del volume): crea il ruolo applicativo `brisk_app`,
lo schema iniziale, le policy RLS e i grant. Per ripartire da zero:

```sh
docker compose down -v   # cancella anche il volume, il prossimo up riesegue init/
docker compose up -d postgres
```

## Comandi principali

```sh
pnpm exec nx run-many -t build typecheck test lint   # tutto il workspace
pnpm exec nx run @brisk/api:serve                     # API NestJS in watch mode
pnpm exec nx run @brisk/editor-app:dev                 # editor React (Vite)
pnpm exec nx run @brisk/public-site:dev                 # sito pubblico Astro
```

Dopo aver aggiunto/spostato una libreria o cambiato le dipendenze tra progetti,
se Nx segnala "workspace out of sync":

```sh
pnpm exec nx sync
```

## Connessione a Postgres

Due ruoli distinti (vedi [ADR-0002](adr/0002-non-superuser-role-for-rls-enforcement.md)):

- **Admin/superuser** (`POSTGRES_USER`/`POSTGRES_PASSWORD` in `.env`): solo per
  migration e task di amministrazione. Bypassa sempre RLS.
- **`brisk_app`** (password in `POSTGRES_APP_PASSWORD`): quello che il backend deve
  usare per ogni query runtime. Rispetta le policy RLS.

Per interrogare manualmente il DB in locale:

```sh
docker compose exec postgres psql -U brisk_app -d brisk
```

Le query fatte così vedranno **zero righe** finché non imposti il tenant di sessione:

```sql
select set_config('app.current_tenant_id', '<uuid-del-tenant>', false);
```
