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
`tenant_id = current_tenant()` policy (see `db/init/002_rls.sql`).
`current_tenant()` reads the Postgres session variable `app.current_tenant_id`,
which the adapter sets at the start of a request from the `TenantContextPort`.

**Critical point**: RLS only protects if the application connection is NOT a
superuser — see [ADR-0002](adr/0002-non-superuser-role-for-rls-enforcement.md).
The `brisk_app` role (created in `db/init/000_roles.sh`) is what the backend must
always use at runtime.

## Content model

A page's "content" is an array of blocks (`PageContent = Block[]`,
`libs/shared-types`), the same format the Puck editor will produce from Phase 2
onward and that `apps/public-site` consumes for server-side rendering. Every page
always has two copies of the content model:

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
  adapters/       concrete Port implementations
  puck-config/    editor block definitions (Phase 2)
  shared-types/   shared content model (Block, PageContent, SeoMeta)

db/
  init/           initial Postgres schema, roles, RLS (see docs/development.md)

docs/
  adr/            Architecture Decision Records
```
