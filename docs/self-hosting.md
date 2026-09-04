# Self-hosting Brisk

This is the production deployment guide (docs/adr/0042). For local
development instead, see [docs/development.md](development.md) — this
doc assumes a real server with a real domain, not a laptop.

## Prerequisites

- A server (VPS or otherwise) with Docker and the Docker Compose plugin
  installed, reachable on ports 80/443.
- A domain you control, with three DNS `A` records already pointing at
  the server before you start: the apex domain, `admin.<domain>`, and
  `api.<domain>` (see "Why three subdomains" below). `www.<domain>` too,
  if you want `www` to work.
- A real SMTP provider (account verification and password-reset emails
  go through it — there is no Mailpit here, that's dev-only).

## Why three subdomains

Brisk ships as three separate containers — the public site, the editor
(`admin.`), and the API (`api.`) — each gets its own subdomain so Caddy
can route to the right one and issue each its own certificate
automatically. If you'd rather use a single domain with path-based
routing, or you already have your own reverse proxy, you can replace
`Caddyfile`/drop the `caddy` service — see its own comment.

## First-time setup

1. Clone this repository (or download a release) onto the server.
2. `cp .env.prod.example .env`, fill in every `CHANGE ME` value — see that
   file's own comments. Generate `PREVIEW_TOKEN_SECRET` with
   `openssl rand -hex 32`.
3. Build and start the database + migration step first:
   ```sh
   docker compose -f docker-compose.prod.yml up -d postgres
   docker compose -f docker-compose.prod.yml up migrate
   ```
4. Start everything else:
   ```sh
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   The first run builds all three app images locally (a few minutes);
   `--build` isn't needed on later restarts.
5. Once DNS has propagated, open `https://admin.<domain>`. A deployment
   nobody has set up yet opens on the **first-run wizard** rather than a
   login screen: give it your site's name, its default language, and the
   email and password for your administrator account. You are logged in as
   soon as it finishes.

That is the whole setup. There is no seed step and no admin password in
your `.env` — the wizard runs once per installation and refuses to run
again afterwards, so there is nothing to clean up either.

Your site has no domain attached yet, which is deliberate: the wizard runs
before anyone can know the public hostname, and it may not even resolve at
that point. Set it in **Site settings** in the editor — until you do, the
public site has no site to match a request against.

### If you would rather not use the wizard

The two seed scripts still exist, for development and for anyone
automating a deployment:

```sh
docker compose -f docker-compose.prod.yml run --rm migrate \
  pnpm --filter @brisk/postgres-db exec tsx scripts/seed-default-tenant.ts
docker compose -f docker-compose.prod.yml run --rm migrate \
  pnpm --filter @brisk/postgres-db exec tsx scripts/seed-default-user.ts
```

They need `DEFAULT_TENANT_ID`, `DEFAULT_SITE_ID`, `DEFAULT_USER_EMAIL` and
`DEFAULT_USER_PASSWORD` set (generate the two ids with `uuidgen`). Be aware
of what that costs: the admin password sits in plaintext in a file on the
server, and stays there. Change it through "Forgot password?" afterwards if
you go this route.

## Choosing a theme

Every bundled theme (`themes/classic`, `themes/docs-showcase`, ...) ships
in the `public-site` image by default — pick which one your site actually
uses live, from editor-app's Style dialog ("Tema"), no rebuild needed.
See [docs/adr/0042](adr/0042-self-hosting-distribution-and-runtime-theme-selection.md).

`BRISK_THEME` in `.env` is a separate, optional knob: a comma-separated
allow-list (`BRISK_THEME=classic`) restricting which of the bundled
themes this deployment will serve at all — what an agency sets so its
client can only ever pick the agency's own theme. Leave it unset to keep
every bundled theme selectable. It's read at runtime, so changing it
needs a restart, not a rebuild:

```sh
docker compose -f docker-compose.prod.yml up -d public-site
```

## Backups

The `postgres-backup` service dumps the whole database on a schedule
(`BACKUP_INTERVAL_SECONDS` in `.env`, default daily) into the
`postgres-backups` named volume, pruning anything older than
`BACKUP_RETENTION_DAYS` (default 14). List what's there:

```sh
docker compose -f docker-compose.prod.yml exec postgres-backup ls -la /backups
```

For offsite/S3 copies, point an existing backup tool (rclone, restic —
don't reinvent one) at that volume; not built into this stack.

### Restoring from a backup

A backup nobody has practiced restoring from isn't a real safety net —
this is the actual procedure, not just "run pg_restore":

1. Stop the app (keep Postgres running): `docker compose -f docker-compose.prod.yml stop api public-site editor-app caddy`
2. Copy the backup file out of the volume if needed, then restore:
   ```sh
   docker compose -f docker-compose.prod.yml exec -T postgres \
     sh -c 'gunzip -c | psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
     < /path/to/brisk-YYYYMMDDTHHMMSSZ.sql.gz
   ```
   This restores into the _existing_ database — if you need a clean
   slate first, drop and recreate it before this step.
3. Restart everything: `docker compose -f docker-compose.prod.yml up -d`

## Upgrading

```sh
git pull
docker compose -f docker-compose.prod.yml up -d --build migrate  # runs and exits
docker compose -f docker-compose.prod.yml up -d --build
```

## Custom themes

Adding a theme Brisk doesn't ship — an agency's own, for a specific
client — means building the `public-site` image yourself with it
included, rather than pulling the published one. See
[themes/README.md](../themes/README.md) for the theme-authoring
convention and
[docs/adr/0042](adr/0042-self-hosting-distribution-and-runtime-theme-selection.md#consequences)
for why this stays a build step rather than an in-product upload flow,
for now.
