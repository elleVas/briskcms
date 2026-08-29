# 0032 — One container per site is the deployment unit; `BRISK_THEME` stays build-time

**Status**: Accepted — 2026-08-30

## Context

`BRISK_THEME` (`apps/public-site/astro.config.mjs`) resolves which filesystem theme package a build uses at **build time**, never per-request — Tier 2 of docs/adr/0021's theming model. This was flagged in a security/architecture review as worth double-checking against the actual business model: if a single running container were ever meant to serve several sites under one account, each potentially wanting its own theme, a build-time-only `BRISK_THEME` would silently force all of them onto the same one.

That question can't be answered by looking at the theming code alone — it depends on what "one deployment" is actually supposed to serve, which turned out to already be answered elsewhere, just never connected to this specific question:

- [ADR-0006](0006-temporary-fixed-tenant-resolution-pre-auth.md): a fresh deployment seeds exactly **one** tenant + **one** site (`DEFAULT_TENANT_ID`/`DEFAULT_SITE_ID`), read from env vars.
- [ADR-0010](0010-session-based-auth-foundations.md), directly: _"this is safe only because Brisk is single-tenant per deployment (self-hosted, not a multi-tenant hosted offering)"_ and _"[`DEFAULT_TENANT_ID`'s narrower job is to] supply a tenant before a session exists in a single-tenant deployment."_
- In the running code today: there is no `POST /sites` endpoint, no site-switcher UI in editor-app, and no way to create a second site under the same tenant at all. `sites` is plural in the schema for RLS/tenant-isolation hygiene (every table being `tenant_id`/`site_id`-scoped from day one, "even if today it's always the same value" per ADR-0006), not because multi-site-per-tenant is a live product feature.

So the model was already decided twice, just never stated in terms of _deployment topology_ — this ADR is that missing statement, not a new decision.

## Decision

**The deployment unit is one container per site.** A client (or an agency's own client) who needs a second site gets a second deployment — its own container, its own `DEFAULT_TENANT_ID`/`DEFAULT_SITE_ID`/`BRISK_THEME`, pointed at either its own database or a shared one scoped by tenant. Nothing about this requires the same database to be off-limits; it's specifically the _serving container_ that stays one-per-site.

`BRISK_THEME` resolved at build time (Tier 2, docs/adr/0021) is correct as-is under this model and needs no change: a container never needs to pick a theme per request because it never serves more than one site's worth of requests to begin with.

No code changes follow from this ADR. It exists to close the open question left in the 2026-08-24/25 security/architecture review's "database residual" notes, and to give future-you (or whoever reads `astro.config.mjs`'s `BRISK_THEME` comment) the actual reasoning instead of a re-litigation.

## Consequences

- `sites` staying schema-plural is deliberate defense-in-depth (RLS/tenant-scoping hygiene), not a half-built feature — don't read its plurality as a signal that multi-site-per-container is coming.
- If a real use case for one container serving multiple differently-themed sites under one account ever shows up, that's a new decision, not a reason to reopen this one on spec: it would need a real `POST /sites` + site-switcher UI + per-request theme resolution (a genuinely bigger feature, not a config tweak) and should be scoped against an actual request, not a hypothetical.
- Local dev is unaffected either way: `DEFAULT_SITE_ID` in `.env` already models exactly one site per running instance, matching this ADR by construction.
