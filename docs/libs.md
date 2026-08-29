# Libraries index

Every `libs/*` package with a one-line summary of what it does and which
app(s) actually import it, linking to that lib's own README for the full
what/how/why. See [docs/architecture.md](architecture.md) for the dependency
graph and layering rules (`domain-core` → `ports` → `application` →
`adapters` → `apps/api`) — this file is a flat reference, not a repeat of
that layering.

"Used by" was verified by grepping `@brisk/<lib-name>` imports across
`apps/*/src`, not guessed from folder names.

## Shared across all three apps

| Lib                                            | What it does                                                                                                                                                                                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [env-config](../libs/env-config/README.md)     | `requireEnv(name)` — fails loudly and immediately when a required environment variable is missing or empty. Used by every app's bootstrap/config code.                                                                                  |
| [shared-types](../libs/shared-types/README.md) | The Zod-schema wire-contract layer: block/page content model, per-block-type props, API DTOs, and the editor↔preview-iframe postMessage protocol. Validated at every network boundary so server and client shapes can't silently drift. |

## Used only by `apps/api`

Core hexagonal-architecture layers:

| Lib                                                   | What it does                                                                                                                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [domain-core](../libs/domain-core/README.md)          | Pure domain entities (`Page`, `Site`, `User`, `Form`, `Media`, ...) encapsulating their own invariants, plus domain error types and an attachment-type byte-sniffer for unauthenticated form uploads. |
| [ports](../libs/ports/README.md)                      | The 19 Port interfaces (persistence, storage, auth, email, search, captcha, newsletter, tenant context) that `application` depends on and every `adapters/*` lib implements.                          |
| [application](../libs/application/README.md)          | Use cases orchestrating Port calls to complete a user action (`createPage`, `saveDraft`, `publishPage`, `rollbackToVersion`, ...) — zero infrastructure of its own.                                   |
| [postgres-db](../libs/adapters/postgres-db/README.md) | Shared Drizzle schema, client factory, and tenant-scoping helper (`withTenant`) used by every Postgres adapter below.                                                                                 |

Postgres repositories (each implements one or two Port interfaces from `ports`, backed by `postgres-db`):

| Lib                                                                                                           | What it does                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [postgres-page-repository](../libs/adapters/postgres-page-repository/README.md)                               | `PageRepositoryPort` + `PageVersionRepositoryPort` — pages, sibling-scoped slug hierarchy, version history saved atomically with the page. |
| [postgres-site-repository](../libs/adapters/postgres-site-repository/README.md)                               | `SiteRepositoryPort` + `SiteThemeBlockStylesPort` — site settings/theme and per-block-type theme style overrides.                          |
| [postgres-site-layout-section-repository](../libs/adapters/postgres-site-layout-section-repository/README.md) | `SiteLayoutSectionRepositoryPort` + version repo — per-site/locale header/footer sections and their history.                               |
| [postgres-form-repository](../libs/adapters/postgres-form-repository/README.md)                               | `FormRepositoryPort` + `FormSubmissionRepositoryPort` — form definitions and their submissions.                                            |
| [postgres-media-repository](../libs/adapters/postgres-media-repository/README.md)                             | `MediaRepositoryPort` — uploaded media _metadata_ only; the file bytes live in the storage adapters below.                                 |
| [postgres-search-repository](../libs/adapters/postgres-search-repository/README.md)                           | `SearchPort` — Postgres full-text search (`tsvector`/`ts_headline`) over published pages.                                                  |
| [postgres-user-repository](../libs/adapters/postgres-user-repository/README.md)                               | `UserRepositoryPort` — admin/editor accounts, with unique-email-violation mapping under concurrency.                                       |

Auth & tokens:

| Lib                                                                                 | What it does                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [session-auth-adapter](../libs/adapters/session-auth-adapter/README.md)             | `AuthPort` — argon2id password hashing, opaque-token DB-backed sessions with sliding renewal.                                                                                                                                     |
| [verification-token-adapter](../libs/adapters/verification-token-adapter/README.md) | `VerificationTokenPort` — single-use DB-backed tokens (atomic `DELETE ... RETURNING`) for email verification, password reset, and user invites.                                                                                   |
| [preview-token-adapter](../libs/adapters/preview-token-adapter/README.md)           | `PreviewTokenPort` — stateless HMAC-signed, non-consuming tokens for the editor's live-preview iframe. No DB table, unlike its session/verification-token cousins.                                                                |
| [opaque-token](../libs/opaque-token/README.md)                                      | `generateOpaqueToken()`/`hashOpaqueToken()` — the "random token, store only its hash" primitive shared by `session-auth-adapter` and `verification-token-adapter`. Not imported by any app directly — only by those two adapters. |

Storage (each pair implements the same Port, swappable at deploy time):

| Lib                                                                                                                                                                   | What it does                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [local-disk-media-storage](../libs/adapters/local-disk-media-storage/README.md) / [s3-media-storage](../libs/adapters/s3-media-storage/README.md)                     | `MediaStoragePort` — curated media-library storage with an EXIF-orient/resize/WebP pipeline. Local-disk vs. S3-compatible; the pipeline code is intentionally duplicated between the two rather than shared (documented tradeoff). |
| [local-disk-attachment-storage](../libs/adapters/local-disk-attachment-storage/README.md) / [s3-attachment-storage](../libs/adapters/s3-attachment-storage/README.md) | `AttachmentStoragePort` — raw-bytes form-attachment storage, no processing. Local-disk vs. S3-compatible, selected via `MEDIA_STORAGE_PROVIDER`.                                                                                   |

Outbound communication:

| Lib                                                                                                                                       | What it does                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [smtp-email-adapter](../libs/adapters/smtp-email-adapter/README.md)                                                                       | `EmailPort` via Nodemailer — generic SMTP, no vendor lock-in.                                                      |
| [brevo-newsletter](../libs/adapters/brevo-newsletter/README.md) / [mailchimp-newsletter](../libs/adapters/mailchimp-newsletter/README.md) | `NewsletterPort` implementations — Brevo's contacts API (upsert) vs. Mailchimp's Marketing API (MD5-keyed upsert). |
| [turnstile-captcha](../libs/adapters/turnstile-captcha/README.md)                                                                         | `CaptchaPort` — Cloudflare Turnstile verification, fail-closed.                                                    |

## Used only by `apps/editor-app`

| Lib                                                | What it does                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [block-registry](../libs/block-registry/README.md) | The editor's block catalog: pure-data descriptors (fields, defaults, container/style rules) per block type, plus React context-based "pickers" for app-specific lookups (media/form/page/icon). Explicitly not a renderer, and deliberately not imported by `apps/public-site` — see the lib's own README for why. |

## Used only by `apps/public-site`

None — every lib `apps/public-site` imports (`env-config`, `shared-types`) is
shared with the other two apps; see the table above.
