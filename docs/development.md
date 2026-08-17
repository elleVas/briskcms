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

`pnpm install` also wires up two Husky hooks:

- **pre-commit** (Husky + lint-staged): runs `eslint --fix` + `prettier
--write` on the files you staged, so a formatting-only failure in CI's
  `nx format:check` step shouldn't happen. Fast — only touches staged files.
- **pre-push**: runs the full `nx run-many -t lint` and `nx run-many -t test
--coverage` (same coverage thresholds as CI, see
  [ADR-0009](adr/0009-enforced-coverage-thresholds.md)) across the whole
  workspace, blocking the push if either fails. Slower than pre-commit by
  design — it runs once per push, not once per commit, so it's the same
  full check CI runs, just caught locally first.

Neither hook runs `build`/`typecheck` — run `nx run-many -t build typecheck`
yourself before opening a PR if you want the exact same gate CI runs end to
end.

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
pnpm --filter @brisk/postgres-db run db:seed
```

After changing `libs/adapters/postgres-db/src/lib/schema.ts`, generate a new
migration (review the generated SQL before committing it — Drizzle can't see
RLS policies or grants, those stay hand-written in
`libs/adapters/postgres-db/drizzle/0001_rls_and_grants.sql` and any future
custom migration needs the same treatment):

```sh
pnpm --filter @brisk/postgres-db run db:generate
```

Every self-hosted instance runs as one fixed tenant/site (see
[ADR-0006](adr/0006-temporary-fixed-tenant-resolution-pre-auth.md)). Auth
now exists (see [ADR-0010](adr/0010-session-based-auth-foundations.md)) —
there's no public registration, so seeding also creates a fixed dev/test
user (`DEFAULT_USER_EMAIL`/`DEFAULT_USER_PASSWORD` in `.env`). Seed once
per fresh database:

```sh
pnpm --filter @brisk/postgres-db run db:seed
```

## Main commands

```sh
pnpm exec nx run-many -t build typecheck test lint   # whole workspace
pnpm exec nx run-many -t test --coverage             # coverage report; enforces the
                                                      # thresholds from ADR-0009
pnpm exec nx run @brisk/api:serve                     # NestJS API in watch mode
pnpm exec nx run @brisk/editor-app:dev                 # React editor (Vite)
pnpm exec nx run @brisk/public-site:dev                 # Astro public site
```

After adding/moving a library or changing dependencies between projects, if Nx
reports "workspace out of sync":

```sh
pnpm exec nx sync
```

To use the Puck editor against real data, run the API and the editor
together (Postgres migrated and seeded first, see above):

```sh
pnpm exec nx run @brisk/api:serve      # http://localhost:3000/api
pnpm exec nx run @brisk/editor-app:dev  # http://localhost:4200
```

Opening `http://localhost:4200` prompts for login first (the dev user from
`db:seed` above) — every Pages route requires a session, see
[ADR-0010](adr/0010-session-based-auth-foundations.md). Once logged in,
with no `?pageId=` it creates a new page against `VITE_DEFAULT_SITE_ID` and
redirects to it. Puck stays isolated inside `apps/editor-app` —
`src/lib/puck-data-mapper.ts` is the only place that translates between
Puck's own data format and Brisk's own `Block[]` (see
[ADR-0007](adr/0007-nested-block-content-model-independent-of-puck.md)).

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
