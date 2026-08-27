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

There is no public registration; new users only ever arrive via an
admin-only invite (`inviteUser`, `apps/api`'s `UsersController`). Same
`VerificationTokenPort` mechanism as above, purpose `'user-invite'`,
7-day TTL: the `User` row is created immediately with `isActive: false` and
an unguessable random password hash, so nobody can sign in until
`acceptInvite` consumes the token, sets a real password, and activates the
account. `resendInvite` mints a fresh token and re-sends the invite email
for a still-pending invite — added because the original token had no
cleanup job and no way to re-issue it, permanently blocking the invitee's
email against `UserEmailAlreadyExistsError` once it expired. A second valid
token for the same pending user is harmless (both work, whichever is used
first wins); `resendInvite` does reject with `UserAlreadyActiveError` once
the invite has already been accepted, since re-sending it at that point
would let the holder reset a real, in-use password outside the
forgot-password flow (which invalidates sessions; this doesn't).

## Domain errors → HTTP mapping

Domain errors (`libs/domain-core/src/lib/errors.ts`, one `Error` subclass
per failure a use case can throw, e.g. `PageNotFoundError`,
`UserEmailAlreadyExistsError`) are mapped to an HTTP status in exactly one
place: `apps/api/src/app/domain-error-http-mapping.ts`'s
`DOMAIN_ERROR_MAPPINGS` table, consumed by the global `HttpExceptionFilter`
(`apps/api/src/app/http-exception.filter.ts`). Controllers never
catch/map domain errors themselves — a use case throws, the filter maps it
(or, if the error isn't in the table, logs it and returns a generic 500).
This replaced seven near-identical private `handleDomainErrors`
try/catch blocks, one per controller. **To add a new domain error**: add the class to
`libs/domain-core`, add one `[ErrorClass, factory]` row to
`DOMAIN_ERROR_MAPPINGS`, done — no controller change needed.

`AuthController` deliberately doesn't go through this table: its three
errors (`InvalidCredentialsError`, `UserNotActiveError`,
`InvalidOrExpiredTokenError`) carry anti-enumeration logic (the same
generic message for "wrong password" and "account disabled" — see
`loginUser`) that a blanket per-class mapping would break, so it stays
handled locally in that controller, unchanged.

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

## Public rendering

`apps/public-site` (Astro, `output: 'server'`, `@astrojs/node`) is a
separate, unauthenticated consumer of content — never `apps/editor-app`'s
authenticated CRUD API, and never Postgres directly. It calls a dedicated
`PublicPagesController` (`apps/api/src/app/public-pages`, no
`SessionAuthGuard`, no write routes at all) that only ever returns
`publishedContent` for a `status: 'published'` page; a draft page and a
nonexistent slug 404 identically. See
[ADR-0012](adr/0012-public-site-rendering-via-dedicated-api-endpoint.md)
for the full reasoning, including why this isn't a Postgres-direct read
the way it might first seem simpler to build.

The site to render is resolved from the request's `Host` header against
`sites.domain` (`SiteRepositoryPort`/`postgres-site-repository`, new in
this decision — previously `siteId` only ever existed as a foreign key,
never a first-class read model) — never a client-supplied ID. Like the
bootstrap lookups in [ADR-0010](adr/0010-session-based-auth-foundations.md),
this has no session to derive a tenant from, so it reuses
`DEFAULT_TENANT_ID` (single-tenant-per-deployment, same caveat as
everywhere else that constant appears).

Block rendering is Astro-native (`src/components/BlockRenderer.astro`,
`src/components/blocks/`), walking `Block[]`/`children` directly — the
"Astro-native renderer" [ADR-0007](adr/0007-nested-block-content-model-independent-of-puck.md)
already anticipated, not Puck's own `<Render>`. Each block's Zod prop
schema (`heroPropsSchema`, `textPropsSchema`) lives in `shared-types`
specifically so `apps/public-site` can validate against it without
depending on Puck or React at all.

## Monorepo

```
apps/
  api/            NestJS — REST/tRPC, DI wiring, TenantContext/auth guards
  editor-app/     React + Puck (Phase 2) — drag-and-drop editor
  public-site/    Astro (SSR, @astrojs/node) — public rendering, no Puck/React

libs/
  domain-core/    pure entities: Page, PageVersion, Site, User, Media, FormSubmission
  ports/          interfaces implemented by the adapters
  application/    use cases (orchestration, zero infrastructure)
  adapters/
    postgres-db/               Drizzle schema, client, tenant-scoping helper —
                                shared by every Postgres adapter
    postgres-page-repository/  PageRepositoryPort + PageVersionRepositoryPort
    postgres-site-repository/  SiteRepositoryPort — domain lookup for public rendering
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
