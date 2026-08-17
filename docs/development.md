# Local development

## Prerequisites

- Node.js 22+
- pnpm (`corepack enable` or `npm i -g pnpm`)
- Docker (for local Postgres)

## Setup

```sh
cp .env.example .env
docker compose up -d postgres
pnpm install
```

`docker compose up -d postgres` automatically runs the scripts in `db/init/`
(only the first time the volume is created): it creates the `brisk_app`
application role, the initial schema, the RLS policies and the grants. To start
fresh:

```sh
docker compose down -v   # also removes the volume, the next up reruns init/
docker compose up -d postgres
```

## Main commands

```sh
pnpm exec nx run-many -t build typecheck test lint   # whole workspace
pnpm exec nx run @brisk/api:serve                     # NestJS API in watch mode
pnpm exec nx run @brisk/editor-app:dev                 # React editor (Vite)
pnpm exec nx run @brisk/public-site:dev                 # Astro public site
```

After adding/moving a library or changing dependencies between projects, if Nx
reports "workspace out of sync":

```sh
pnpm exec nx sync
```

## Connecting to Postgres

Two distinct roles (see [ADR-0002](adr/0002-non-superuser-role-for-rls-enforcement.md)):

- **Admin/superuser** (`POSTGRES_USER`/`POSTGRES_PASSWORD` in `.env`): only for
  migrations and admin tasks. Always bypasses RLS.
- **`brisk_app`** (password in `POSTGRES_APP_PASSWORD`): what the backend must use
  for every runtime query. Respects the RLS policies.

To query the DB manually locally:

```sh
docker compose exec postgres psql -U brisk_app -d brisk
```

Queries run this way will see **zero rows** until you set the session tenant:

```sql
select set_config('app.current_tenant_id', '<tenant-uuid>', false);
```
