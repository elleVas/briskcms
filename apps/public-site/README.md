# @brisk/public-site

The public-facing site: server-rendered Astro, no Puck/React dependency —
see [ADR-0012](../../docs/adr/0012-public-site-rendering-via-dedicated-api-endpoint.md)
for why, and `docs/development.md` for how to run it locally alongside
`apps/api`.

## How a request is served

1. `src/pages/[slug].astro` (or `src/pages/index.astro` for `/`, fetching
   the page slugged `home` — Astro's own native routing for `/`, not a
   custom convention) resolves the site from the request's `Host` header
   and calls `apps/api`'s public, unauthenticated
   `GET /public/pages/by-slug` (`src/lib/public-api-client.ts`).
2. A page that isn't published, or doesn't exist, both 404 identically —
   see `src/components/NotFound.astro` and `src/pages/404.astro`.
3. A published page's `Block[]` content is walked directly by
   `src/components/BlockRenderer.astro` and rendered with native `.astro`
   components (`src/components/blocks/`) — never Puck's own `<Render>`,
   see [ADR-0007](../../docs/adr/0007-nested-block-content-model-independent-of-puck.md).
   Each block's prop shape is validated against the same Zod schema
   `@brisk/puck-config` uses for the editor (`@brisk/shared-types`), so the
   two can never silently drift apart.

## Commands (via Nx from the repo root)

```sh
pnpm exec nx run @brisk/public-site:dev         # dev server, http://localhost:4321
pnpm exec nx run @brisk/public-site:build       # production build (SSR, @astrojs/node)
pnpm exec nx run @brisk/public-site:typecheck   # astro check
pnpm exec nx run @brisk/public-site:test        # vitest
pnpm exec nx run @brisk/public-site:lint        # eslint
```

Needs `apps/api` running and `API_URL` pointing at it (see `.env.example`)
— there is no build-time list of pages to prerender, content is fetched
per-request.
