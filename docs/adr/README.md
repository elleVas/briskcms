# Architecture Decision Records

Log of Brisk's architectural decisions that involve a real trade-off (more than
one reasonable way to do the same thing). Not every implementation choice
deserves an ADR — only the ones where someone, in the future, would ask "why
didn't they do it the other way?".

Format: [Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
— Title, Status, Context, Decision, Consequences.

An accepted ADR is never edited: if a decision changes, a new one is written that
explicitly supersedes it (status `Superseded by ADR-000X`).

| ADR                                                                     | Title                                                                        | Status   |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------- |
| [0001](0001-public-repository-for-branch-protection.md)                 | Public repository to enable branch protection                                | Accepted |
| [0002](0002-non-superuser-role-for-rls-enforcement.md)                  | Dedicated non-superuser Postgres role for the app                            | Accepted |
| [0003](0003-separate-application-layer-for-use-cases.md)                | Separate `application` layer for use cases                                   | Accepted |
| [0004](0004-drizzle-as-schema-source-of-truth.md)                       | Drizzle as the schema source of truth                                        | Accepted |
| [0005](0005-ci-postgres-credentials-generated-in-job.md)                | CI Postgres credentials generated in-job, not from repo secrets              | Accepted |
| [0006](0006-temporary-fixed-tenant-resolution-pre-auth.md)              | Temporary fixed-tenant resolution before auth exists                         | Accepted |
| [0007](0007-nested-block-content-model-independent-of-puck.md)          | Nested `Block` content model, independent of Puck's data format              | Accepted |
| [0008](0008-disable-enforce-buildable-lib-dependency.md)                | Disable `enforceBuildableLibDependency`                                      | Accepted |
| [0009](0009-enforced-coverage-thresholds.md)                            | Enforced test coverage thresholds                                            | Accepted |
| [0010](0010-session-based-auth-foundations.md)                          | Session-based auth foundations, roll-your-own instead of Lucia/Better-Auth   | Accepted |
| [0011](0011-email-verification-password-reset.md)                       | Email verification, password reset, and the editor-app design system         | Accepted |
| [0012](0012-public-site-rendering-via-dedicated-api-endpoint.md)        | Public site rendering via a dedicated unauthenticated API endpoint           | Accepted |
| [0013](0013-media-pipeline-local-serving-upload-time-resize.md)         | Media pipeline: API-served local storage, resize at upload time              | Accepted |
| [0014](0014-seo-metadata-editing-and-schema-org-scope.md)               | SEO metadata editing surface, and schema.org scope                           | Accepted |
| [0015](0015-form-builder-architecture.md)                               | Form builder: entity, field propagation, and scope                           | Accepted |
| [0016](0016-site-general-and-seo-settings.md)                           | Site general settings and search engine indexing control                     | Accepted |
| [0017](0017-multilingua-locale-prefixed-urls-and-page-translations.md)  | Multilingua: locale-prefixed URLs and page translations                      | Accepted |
| [0018](0018-site-level-header-footer-layout-sections.md)                | Header/Nav/Footer as site-level layout sections                              | Accepted |
| [0019](0019-canvas-inline-text-editing.md)                              | Canvas inline text editing via Puck's `contentEditable`                      | Accepted |
| [0020](0020-form-builder-anti-spam-newsletter-attachments-multistep.md) | Form builder extensions: anti-spam, newsletter, file attachments, multi-step | Accepted |
| [0021](0021-site-theming-filesystem-packages-and-style-settings.md)     | Site theming: filesystem theme packages + DB-backed style settings           | Accepted |
| [0022](0022-component-and-instance-style-overrides.md)                  | Component-level and instance-level style overrides                           | Accepted |
| [0023](0023-icon-system-theme-provided-manifest.md)                     | Icon system: theme-provided manifest, curated default set                    | Accepted |
