# 0002 — Dedicated non-superuser Postgres role for the app

**Status**: Accepted — 2026-08-17

## Context

The initial schema (`db/init/001_schema.sql`) enables Row Level Security with
`FORCE ROW LEVEL SECURITY` on every table with `tenant_id`, with a
`tenant_id = current_tenant()` policy. A manual test with two tenants, connected
as the default Postgres user (created by `POSTGRES_USER` in the official
`postgres` image), showed that **both tenants could see all rows** — isolation
wasn't working.

Cause: that user is a Postgres superuser. Superusers always bypass Row Level
Security, regardless of `FORCE ROW LEVEL SECURITY` — that clause only applies to
the table owner when it's *not* a superuser.

## Decision

`db/init/000_roles.sh` creates a dedicated application role `brisk_app`,
non-superuser, without `BYPASSRLS`, with only basic CRUD privileges
(`db/init/003_grants.sql`). The backend **always** connects as `brisk_app` for
runtime queries. The `POSTGRES_USER`/superuser role is reserved for migrations
and admin tasks.

Manually verified: connected as `brisk_app`, one tenant never sees another
tenant's rows; with no `app.current_tenant_id` set in the session, visibility is
zero (fail-closed).

## Consequences

- Every Postgres adapter (`libs/adapters/postgres-page-repository`, and future
  ones) must use the connection string with `brisk_app`, never the admin one —
  to be documented explicitly in each adapter's setup and checked in code review.
- Migrations (Phase 1+, Drizzle) instead run with the admin/superuser user,
  because they need to create roles/policies/extensions that `brisk_app` doesn't
  have permission to create.
- Any new table with `tenant_id` must receive the same grants to `brisk_app` in
  `003_grants.sql` (or the equivalent Drizzle migration), otherwise the app gets
  permission errors instead of a simple RLS filter.
