# Architecture Decision Records

Log of Brisk's architectural decisions that involve a real trade-off (more than
one reasonable way to do the same thing). Not every implementation choice
deserves an ADR — only the ones where someone, in the future, would ask "why
didn't they do it the other way?".

Format: [Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
— Title, Status, Context, Decision, Consequences.

An accepted ADR is never edited: if a decision changes, a new one is written that
explicitly supersedes it (status `Superseded by ADR-000X`).

| ADR                                                            | Title                                                           | Status   |
| -------------------------------------------------------------- | --------------------------------------------------------------- | -------- |
| [0001](0001-public-repository-for-branch-protection.md)        | Public repository to enable branch protection                   | Accepted |
| [0002](0002-non-superuser-role-for-rls-enforcement.md)         | Dedicated non-superuser Postgres role for the app               | Accepted |
| [0003](0003-separate-application-layer-for-use-cases.md)       | Separate `application` layer for use cases                      | Accepted |
| [0004](0004-drizzle-as-schema-source-of-truth.md)              | Drizzle as the schema source of truth                           | Accepted |
| [0005](0005-ci-postgres-credentials-generated-in-job.md)       | CI Postgres credentials generated in-job, not from repo secrets | Accepted |
| [0006](0006-temporary-fixed-tenant-resolution-pre-auth.md)     | Temporary fixed-tenant resolution before auth exists            | Accepted |
| [0007](0007-nested-block-content-model-independent-of-puck.md) | Nested `Block` content model, independent of Puck's data format | Accepted |
