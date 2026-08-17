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

`docker compose up -d postgres` automatically runs `db/init/000_roles.sh` (only
the first time the volume is created): it creates the `brisk_app` application
role. The schema itself (tables, RLS policies, grants) is managed by Drizzle —
see [ADR-0004](adr/0004-drizzle-as-schema-source-of-truth.md) — and applied
separately:

```sh
pnpm --filter @brisk/postgres-db run db:migrate
```

To start fresh:

```sh
docker compose down -v   # also removes the volume, the next up reruns db/init/000_roles.sh
docker compose up -d postgres
pnpm --filter @brisk/postgres-db run db:migrate
```

After changing `libs/adapters/postgres-db/src/lib/schema.ts`, generate a new
migration (review the generated SQL before committing it — Drizzle can't see
RLS policies or grants, those stay hand-written in
`libs/adapters/postgres-db/drizzle/0001_rls_and_grants.sql` and any future
custom migration needs the same treatment):

```sh
pnpm --filter @brisk/postgres-db run db:generate
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
