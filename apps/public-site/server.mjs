// Production entrypoint — run this after `astro build`, NOT
// `dist/server/entry.mjs` directly (astro.config.mjs sets adapter mode to
// 'middleware', which only exports a request handler and does not start a
// server or serve static files on its own).
//
// Why this file exists at all: the canvas editor's live-preview iframe
// (apps/editor-app/src/app/canvas/canvas-frame.tsx) is sandboxed WITHOUT
// allow-same-origin (a deliberate fix against stored XSS via untrusted
// user-inserted blocks), which gives it an opaque origin. Every
// `type="module"` script/CSS request it makes — even to this same host —
// therefore requires a CORS check. In production those are the static
// bundles under `_astro/`; @astrojs/node's 'standalone' mode serves those
// via its own static file server BEFORE any Astro middleware ever sees the
// request, so there is no way to attach the header from within Astro
// itself. Serving those files ourselves, here, is the only choke point
// that can add it.
import { createServer } from 'node:http';
import sirv from 'sirv';
import { handler as astroHandler } from './dist/server/entry.mjs';

const ASSETS_PREFIX = '/_astro/';

const serveAssets = sirv('dist/client', { dev: false });

const server = createServer((req, res) => {
  if (req.url?.startsWith(ASSETS_PREFIX)) {
    // These are public, tenant-agnostic asset bundles (no user/tenant data
    // ever ends up in them), so a wildcard is safe here. Never reflect the
    // sandboxed iframe's `Origin: null` back as the allowed origin instead
    // — that's a known anti-pattern that would let ANY sandboxed iframe on
    // the internet read the response too, not just ours.
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  serveAssets(req, res, () => astroHandler(req, res));
});

// PUBLIC_SITE_PORT (not the bare PORT every other local app already reads
// from the same root .env — apps/api defaults to it too, see
// apps/api/src/main.ts) is checked first so this can have its own stable
// local port (4322, see docs/development.md) without stealing apps/api's.
// A real deployment still only ever sets plain PORT, which stays the
// fallback here.
const port = Number(process.env.PUBLIC_SITE_PORT ?? process.env.PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';
server.listen(port, host);
