# 0088 — The editor is tested in a browser, on every PR

**Status**: Accepted — 2026-09-26

## Context

Until now nothing ran the three apps together. Unit and integration tests
cover each piece, and the checks that crossed them (the canvas, the public
form, the accessibility audit) were one-off scripts driving Chrome by hand
over CDP, run once and thrown away. A regression in any of those paths
would be found by a person, later.

The first run of a real suite found three things no other test had: the
pages list asked the API for 200 users when it accepts 100, so the
"Created by" filter had never had anyone in it; a block inserted while the
canvas is still loading is saved but not drawn; and restoring a header
version right after an edit is overwritten by that edit.

## Decision

- **Playwright, in its own project, `apps/e2e`.** One suite for the three
  apps, since every flow worth testing crosses at least two of them.
  Chromium only.
- **Four groups to start**: the main path (log in through the form, new
  page, a block, its text edited in the canvas, publish, the page on the
  site); a form end to end (a condition set in the editor, the field
  hidden and shown on the site, the submission saved, one email per
  notification address in Mailpit); the canvas (Layers reordered by mouse
  and keyboard, a header version restored); the accessibility gate (axe,
  WCAG 2.2 AA, on all 18 editor screens, both themes, 1440 and 390px,
  which also fails on any API error a screen gets).
- **From outside.** The suite talks to the API over HTTP and reads its
  answers with its own small zod schemas, listing only the fields it
  reads, not `@brisk/shared-types`: that package's barrel would pull half
  the workspace into the test runner, and a suite that shares the apps'
  types would agree with them by construction. It borrows only
  `@brisk/env-config`, and a lint rule (tag `e2e`) keeps it that way.
- **It cleans up after itself.** Locally it runs against the developer's
  own database, so everything a test makes has an `e2e-…` name and is
  removed by a fixture whatever the outcome. The header, which belongs to
  the site, is put back as it was.
- **Logged in once**, through the API, and the session reused while it
  is valid: login allows five attempts per account in fifteen minutes.
  One test logs in through the form, so that path stays covered.
- **What it found is fixed here.** The users list asks for the API's
  own ceiling, 100. The canvas says "Loading the page…" and keeps the
  block palette off until the page in the iframe answers `preview:ready`,
  and every new document in the iframe (a restore, a page change) starts
  not ready again. The shell hands the views its flush (`flushRef`), and
  a restore sends any change still in the debounce before it waits for
  the save queue, as Publish already did.
- **In CI, a job of its own** (`e2e`), beside `test`, sharing its Postgres
  and Mailpit through `.github/actions/start-services`. It builds the
  three apps and Playwright starts them from the build. It is not a
  required check until it has shown itself stable.

## Consequences

- A failing run leaves a report with a trace per failed test as an
  artifact; the saved session is left out of it, since the repository is
  public.
- The suite waits the way a person would, on what the screen shows: the
  canvas's loading message to go, the captcha to hand over its token
  before submitting.
- Two runs of the header test at once would share the site's one header;
  the test refuses to start while the draft already holds test blocks.
- Locally, the header test leaves versions in the header's history.
