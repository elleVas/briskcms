# Local development

## Prerequisites

- Node.js 22+
- pnpm (`corepack enable` or `npm i -g pnpm`)
- Docker (for local Postgres)

## Setup

```sh
cp .env.example .env
docker compose up -d postgres mailpit
pnpm install
```

`mailpit` is a local SMTP catcher — it receives every email Brisk sends in
dev (verification, password reset) without a real provider. Web UI at
<http://localhost:8025>.

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
`libs/adapters/postgres-db/drizzle/0000_baseline_schema.sql` and any future
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

To use the canvas editor against real data, run the API and the editor
together (Postgres migrated and seeded first, see above):

```sh
pnpm exec nx run @brisk/api:serve      # http://localhost:3000/api
pnpm exec nx run @brisk/editor-app:dev  # http://localhost:4200
```

Opening `http://localhost:4200` prompts for login first (the dev user from
`db:seed` above) — every Pages route requires a session, see
[ADR-0010](adr/0010-session-based-auth-foundations.md). Once logged in, it
lands on `/pages`, the admin shell's list of pages for
`VITE_DEFAULT_SITE_ID`; "Nuova pagina" creates one and opens it in the
fullscreen canvas editor at `/pages/:id`
(`apps/editor-app/src/app/canvas/canvas-editor-shell.tsx`), also requiring
`apps/public-site` to be running (see below) — the canvas embeds the real
page in an `<iframe>` and drives it via `postMessage`, it doesn't render
blocks itself in React. There is no data-format mapping layer to isolate
anymore: the canvas reads and writes Brisk's own `Block[]` directly (see
[ADR-0007](adr/0007-nested-block-content-model-independent-of-puck.md) for
why `Block[]` was designed independent of any editor library in the first
place, and [ADR-0028](adr/0028-canvas-inline-text-editing-via-tiptap-in-preview-iframe.md)
for how the iframe/`postMessage` canvas works, including inline text
editing).

**Canvas rendering needs `public-site`'s production build, not `nx run
@brisk/public-site:dev`.** Astro's dev server (v6.0+; this project is on
7.2.2) hard-blocks every subresource request whose `Sec-Fetch-Site` isn't
`same-origin`/`same-site`/`none` and whose `Origin` doesn't validate
against `security.allowedDomains`
(`node_modules/astro/dist/vite-plugin-astro-server/sec-fetch.js`). The
canvas's preview `<iframe>` is sandboxed _without_ `allow-same-origin`
(`apps/editor-app/src/app/canvas/canvas-frame.tsx`) — a deliberate fix
against stored XSS via untrusted user-inserted blocks/scripts — which
gives it an opaque origin (`Origin: null`). `new URL('null')` always
throws, so that origin can never validate against `allowedDomains` no
matter how it's configured — there is no config escape hatch for this.
The initial page navigation into the iframe still works
(`Sec-Fetch-Mode: navigate` is always allowed), but every script/CSS
module the loaded page then fetches gets a flat `403 Cross-origin request
blocked`. This is Astro's own dev-server hardening, not a bug in this
codebase.

This does **not** affect production — `server.mjs` (the real production
entrypoint, see `apps/public-site/README.md`) has no such middleware.
This is why `.env.example`'s `VITE_PUBLIC_SITE_URL` points at
`http://localhost:4322` (`PUBLIC_SITE_PORT`, also in `.env.example`), not
at `nx serve`'s `:4321` — the canvas needs the production build running
locally, always, not just as an occasional workaround:

```sh
pnpm exec nx run @brisk/public-site:build
pnpm exec nx run @brisk/public-site:start   # node server.mjs, :4322 (PUBLIC_SITE_PORT)
```

Keep that process running the same way you keep `api`/`editor-app`
running, and rebuild it after every public-site content/block change you
want reflected in the canvas — there's no live-reload here, unlike
`nx serve`. `nx serve @brisk/public-site` (`:4321`) is still the right tool any time
you're working on public-site itself without going through the canvas —
styling a block, checking content changes live. The two servers can run
side by side on their own ports. One consequence of `VITE_PUBLIC_SITE_URL`
now pointing at the production build by default: the editor's "Visualizza
pagina" link opens that same build too, so it can look stale until you
rebuild — swap the env var to `:4321` locally if you want that link to
always reflect your latest unbuilt changes instead.

The login screen's "Password dimenticata?" link leads to a password-reset
request form; the actual reset link Brisk emails opens
`http://localhost:4200/reset-password?resetToken=...`, and a verification
email opens `/verify-email?verifyToken=...` — both read straight from
Mailpit at <http://localhost:8025>, there's no need for a real inbox in
dev. See
[ADR-0011](adr/0011-email-verification-password-reset.md) for the full
design (why login isn't gated on verification yet, anti-enumeration on the
reset-request endpoint, and why a password reset invalidates all of that
user's existing sessions).

To see a published page rendered on the public site, run the API and
public-site together:

```sh
pnpm exec nx run @brisk/api:serve         # http://localhost:3000/api
pnpm exec nx run @brisk/public-site:dev    # http://localhost:4321
```

`apps/public-site` calls `apps/api`'s public, unauthenticated endpoint
(`GET /public/pages/by-slug`, see `apps/api/src/app/public-pages`) — never
the authenticated CRUD one editor-app uses. It resolves which site to
render from the request's `Host` header, matched against a site's `domain`
column, so a page only ever appears at the domain it's actually configured
for. `db:seed` sets the seeded default site's domain to `localhost`
specifically so this resolves out of the box in local dev
(`http://localhost:4321/...`); a real deployment sets each site's `domain`
to what it's actually served on. `API_URL` (plain server env var, not
`VITE_`/`PUBLIC_`-prefixed — read from `process.env` at request time, not
baked in at build time, see `src/lib/public-api-client.ts`) points
public-site at the API.

A page's slug becomes its path (`/chi-siamo`); `/` is Astro's own
`src/pages/index.astro`, which — by content convention, not a routing
special-case — renders whichever page is slugged `home`. Only
`status: 'published'` pages are ever reachable this way; a draft page and
a nonexistent slug both 404 identically, on purpose (see that use case's
own comments on why). Block rendering here is Astro-native (`Hero.astro`,
`Text.astro`, `BlockRenderer.astro`) and walks `Block[]`/`children`
directly — apps/public-site never depends on any editor-side library at
all (see [ADR-0007](adr/0007-nested-block-content-model-independent-of-puck.md)).

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
