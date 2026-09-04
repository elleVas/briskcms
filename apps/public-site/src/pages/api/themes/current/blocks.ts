import type { APIRoute } from 'astro';
import { listThemePageBlocks } from '../../../../lib/resolve-theme-page-blocks';
import { themesApiCorsHeaders } from '../../../../lib/themes-api-cors';

// Docs/adr/0041/0042, same pattern/reasoning as icons.ts and
// block-style-defaults.ts: resolved here because only apps/public-site
// has real access to themes/ — called by editor-app once per session to
// merge a theme's extra block types into its block picker/Inspector.
//
// Passes `[]` for the core-type collision list on purpose, not a gap:
// re-deriving the real core type list here would mean importing
// `@brisk/block-registry` into apps/public-site, which has already
// caused a real TypeScript resolution conflict once (see
// resolve-theme-block-style-defaults.ts's own comment). The actual,
// reliable collision gate is each theme's own blocks.spec.ts (see
// themes/classic/blocks/blocks.spec.ts's comment) — it imports
// block-registry directly (safe: theme packages are "app"-tagged,
// block-registry is "domain") and runs unconditionally in CI, so a
// collision fails the build before this code ever ships, regardless of
// which route a given server process happens to serve first.
// `BlockRenderer.astro`'s own call (with the real list) stays as a
// second, defense-in-depth check — cheap to keep, not the primary gate.
export const prerender = false;

export const OPTIONS: APIRoute = () =>
  new Response(null, { status: 204, headers: themesApiCorsHeaders() });

export const GET: APIRoute = ({ url }) =>
  new Response(
    JSON.stringify(
      listThemePageBlocks([], url.searchParams.get('theme') ?? ''),
    ),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...themesApiCorsHeaders(),
      },
    },
  );
