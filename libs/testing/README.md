# testing

What the specs of `application`, the adapters and the apps share, so each
one stops rebuilding the same fixtures by hand.

- **Entity builders** — `buildSite`, `buildUser`, `buildPageGroup`,
  `buildPageTranslation`, `buildSiteLayoutSection`, `buildReusableSection`.
  Fixed, readable defaults (`site-1`, `tenant-1`); a spec passes as
  overrides only the fields its test is about.
- **In-memory repositories** — one per repository port, for use cases
  tested without a database.
- **Fake ports** — auth, captcha, email, newsletter, verification tokens.

## Rules

- **Specs only.** A lint rule (`no-restricted-imports` in the root
  `eslint.config.mjs`) refuses `@brisk/testing` anywhere but `*.spec.*`,
  `*.test-fixture.*`, `src/test/` and test setup files: a fake that reached
  production code would ship.
- **Not for `domain-core` or `shared-types`.** This library depends on them,
  so their specs importing it would be a cycle. Tests of an entity build
  that entity themselves.
- **No database, no framework.** Postgres fixtures live next to their
  cleanup in `@brisk/postgres-db`; the API's integration app setup lives in
  `apps/api`, because it needs Nest modules a library cannot depend on.
- Every file is a `*.test-fixture.ts`, so coverage leaves it out of the
  denominator (docs/adr/0009): it is test support, not code under test.
