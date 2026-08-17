# Architecture

Brisk follows Ports & Adapters (hexagonal architecture): the domain knows nothing
about infrastructure details, infrastructure lives only in the adapters. See also
[docs/adr](adr/) for decisions with a real trade-off behind them.

## Dependency graph

```
domain-core   (pure entities, zero dependencies)
    ^
    |
  ports       (interfaces: PageRepositoryPort, MediaStoragePort, AuthPort, ...)
    ^
    |
application   (use cases: createPage, saveDraft, publishPage, listPageVersions,
               rollbackToVersion — depends on domain-core + ports)
    ^
    |
adapters/*    (concrete Port implementations: Postgres, local/S3 storage, auth)
    ^
    |
 apps/api     (NestJS — DI wiring: injects concrete adapters behind the Port
               interfaces, exposes REST/tRPC)
```

`shared-types` is cross-cutting: it defines the content model (`Block`,
`PageContent`, `SeoMeta`) shared between `domain-core`, `apps/editor-app` and
`apps/public-site`, so the editor, API and rendering can never drift on what a
block means.

Rule of thumb for where a new piece of code belongs:

- **Changes only an entity's business rules** (e.g. "a published page can't go back
  to draft without a new publish") → `domain-core`.
- **The domain needs a new way to talk to the outside world** (new kind of
  repository, new storage) → new interface in `ports`.
- **Orchestrates several Port calls to complete a user action** → new use case in
  `application`.
- **Concretely implements a Port** (SQL query, S3 call, password hashing) → new
  adapter in `libs/adapters/`.

## Multi-tenancy and Row Level Security

Every table with per-tenant data has `tenant_id` from day one (even in
single-tenant mode) and Row Level Security enabled with a
`tenant_id = current_tenant()` policy (see
`libs/adapters/postgres-db/drizzle/0001_rls_and_grants.sql`).
`current_tenant()` reads the Postgres session variable `app.current_tenant_id`.
Every Postgres adapter must set it via `withTenant()` (`libs/adapters/postgres-db`)
before running a query — it sets the variable inside a transaction
(`is_local = true`), not for the whole session, because connections are pooled
and reused across requests for different tenants.

**Critical point**: RLS only protects if the application connection is NOT a
superuser — see [ADR-0002](adr/0002-non-superuser-role-for-rls-enforcement.md).
The `brisk_app` role (created in `db/init/000_roles.sh`) is what the backend must
always use at runtime. Schema and RLS policies are Drizzle-managed — see
[ADR-0004](adr/0004-drizzle-as-schema-source-of-truth.md).

## Auth

Session-based, roll-your-own (Lucia Auth was deprecated in March 2025 — see
[ADR-0010](adr/0010-session-based-auth-foundations.md) for the full
rationale, including why `DEFAULT_TENANT_ID` still exists after auth
landed). `SessionAuthGuard` (`apps/api/src/app/auth/`) validates the
`brisk_session` cookie on every `PagesController` route and attaches the
resolved tenant/user to the request; `SessionTenantContextAdapter` reads it
back out as the `TenantContextPort` for that request — replacing the
temporary `StaticTenantContextAdapter` from
[ADR-0006](adr/0006-temporary-fixed-tenant-resolution-pre-auth.md).
`libs/adapters/session-auth-adapter` implements `AuthPort` (argon2id
hashing via `@node-rs/argon2`, opaque DB-backed sessions — never a JWT).
There is no public registration endpoint; the dev/test user comes from
`pnpm --filter @brisk/postgres-db run db:seed`.

Email verification and password reset (see
[ADR-0011](adr/0011-email-verification-password-reset.md)) use a second,
separate opaque-token mechanism (`libs/adapters/verification-token-adapter`,
single-use via an atomic `DELETE ... RETURNING`) rather than reusing
sessions — both share their random-token generation/hashing through
`libs/opaque-token`. `libs/adapters/smtp-email-adapter` implements
`EmailPort` via `nodemailer`; Brisk's own HTML email templates live in
`libs/application/src/lib/emails/`. Login is not currently gated on email
verification — an explicitly tracked future decision, not an oversight (see
ADR-0011).

## Content model

A page's "content" is an array of blocks (`PageContent = Block[]`,
`libs/shared-types`), each optionally holding nested `children: Block[]` for
container-style blocks (e.g. columns) — Brisk's own nesting vocabulary, not
Puck's `zones`. Puck stays isolated inside `apps/editor-app`: a mapping layer
there converts Puck's own `Data` format (root/content/zones) to/from
`Block[]`, so the domain, the Postgres schema, and `apps/public-site`'s
renderer never need to know Puck's data format exists — see
[ADR-0007](adr/0007-nested-block-content-model-independent-of-puck.md). Every
page always has two copies of the content model:

- `content` — the latest draft, editable.
- `publishedContent` — the last version actually published, immutable until the
  next `publish()`.

Every save (creation, draft, rollback) creates a row in `page_versions` (never a
destructive overwrite) — see `Page` in `libs/domain-core` and the use cases in
`libs/application/src/lib/use-cases/`.

## Monorepo

```
apps/
  api/            NestJS — REST/tRPC, DI wiring, TenantContext/auth guards
  editor-app/     React + Puck (Phase 2) — drag-and-drop editor
  public-site/    Astro — public rendering of the sites

libs/
  domain-core/    pure entities: Page, PageVersion, User, Media, FormSubmission
  ports/          interfaces implemented by the adapters
  application/    use cases (orchestration, zero infrastructure)
  adapters/
    postgres-db/               Drizzle schema, client, tenant-scoping helper —
                                shared by every Postgres adapter
    postgres-page-repository/  PageRepositoryPort + PageVersionRepositoryPort
    postgres-user-repository/  UserRepositoryPort
    session-auth-adapter/      AuthPort — argon2id hashing, DB-backed sessions
    verification-token-adapter/ VerificationTokenPort — single-use email
                                verification/password-reset tokens
    smtp-email-adapter/        EmailPort via nodemailer
  puck-config/    editor block definitions (Phase 2)
  shared-types/   shared content model (Block, PageContent, SeoMeta)
  env-config/     requireEnv() — fail loudly on a missing required env var,
                   shared by every adapter/app/script that needs one
  opaque-token/   generateOpaqueToken()/hashOpaqueToken() — shared by
                   session-auth-adapter and verification-token-adapter

db/
  init/           brisk_app role bootstrap (see docs/development.md);
                   schema/RLS/grants live in libs/adapters/postgres-db/drizzle/

docs/
  adr/            Architecture Decision Records
```
