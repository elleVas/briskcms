// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Tier 2 of docs/adr/0021's theming model: which filesystem theme package
// (../../themes/<name>) this build resolves `~theme/*` imports to. Build-
// time only, by design (never read per-request) — the Docker image is the
// unit of distribution, so changing a site's theme means a rebuild, the
// same cost as every other deployment-level config in this product. Not a
// gap: docs/adr/0032 confirms the deployment unit is one container per
// site, so a container never needs to pick a theme per request.
const themeName = process.env.BRISK_THEME || 'classic';
const themeDir = fileURLToPath(
  new URL(`../../themes/${themeName}/`, import.meta.url),
);

// https://astro.build/config
export default defineConfig({
  // Server output: page content lives in Postgres, fetched per-request from
  // apps/api (see src/lib/public-api-client.ts) — there is no fixed set of
  // pages to know about at build time.
  output: 'server',
  adapter: node({
    // Middleware (not standalone): the sandboxed canvas iframe's opaque
    // origin needs Access-Control-Allow-Origin on the static asset bundles
    // under `_astro/` (see the CORS comment below) — standalone's built-in
    // static file server runs before any Astro middleware ever sees the
    // request, so it can't add that header. `server.mjs` (the real
    // production entrypoint, not `dist/server/entry.mjs` directly) wraps
    // this exported handler with its own static serving via `sirv` instead.
    mode: 'middleware',
  }),
  // Available to any theme (docs/adr/0021), not used by core's own blocks:
  // ADR-0019's "no framework" precedent stays the default for blocks we
  // ship, but nothing stops a theme author from dropping a .tsx component
  // and hydrating it with a client: directive — Astro islands mean it costs
  // nothing on a page that never uses one.
  integrations: [react()],
  vite: {
    plugins: [
      tailwindcss(),
      {
        // Il canvas dell'editor (apps/editor-app/canvas-frame.tsx) carica
        // questa pagina in un iframe sandboxato SENZA allow-same-origin
        // (fix dello stored XSS via blocchi utente non fidati) — la sua
        // origine è quindi opaca, e il browser tratta OGNI richiesta che fa,
        // anche verso questo stesso host, come cross-origin. Questo header
        // resta necessario ma NON basta da solo in dev: il dev server di
        // Astro (>= 6.0) blocca comunque queste richieste con un 403 fisso
        // prima ancora che questo header conti, perché `Origin: null`
        // (origine opaca) non passa mai la sua validazione interna — vedi
        // "Canvas rendering needs public-site's production build" in
        // docs/development.md per la spiegazione completa e il workaround
        // (build + `server.mjs` invece di `nx serve` quando si lavora sul
        // canvas). L'equivalente per la build di produzione (asset statici
        // sotto `_astro/`, serviti da `sirv` non da Vite, dove il blocco di
        // Astro non esiste) vive in `server.mjs`, non qui.
        // Esclude esplicitamente /api/*: render-block-fragment.ts ha il
        // proprio scoping CORS su EDITOR_APP_URL (vedi il commento su
        // `cors: false` sotto) e non deve mai essere sovrascritto qui.
        name: 'brisk-dev-sandboxed-iframe-cors',
        apply: 'serve',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (!req.url?.startsWith('/api/')) {
              res.setHeader('Access-Control-Allow-Origin', '*');
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '~theme': themeDir,
      },
    },
    server: {
      // Il dev server di Vite intercetta ogni preflight OPTIONS con la
      // propria risposta CORS generica, prima ancora che raggiunga la
      // rotta Astro — impedirebbe a render-block-fragment.ts's export
      // OPTIONS/i suoi header CORS scoped a EDITOR_APP_URL di funzionare
      // in dev (in produzione questo non esiste affatto: l'adapter Node
      // standalone non passa da Vite). Disabilitato così è sempre la
      // rotta stessa a rispondere, identico tra dev e produzione.
      cors: false,
    },
  },
});
