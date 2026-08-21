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
// same cost as every other deployment-level config in this product.
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
    // Standalone: runs as its own Node HTTP server (see docs' "Dockerfile
    // production (Node runtime)" plan) — no host app to attach a middleware
    // to.
    mode: 'standalone',
  }),
  // Available to any theme (docs/adr/0021), not used by core's own blocks:
  // ADR-0019's "no framework" precedent stays the default for blocks we
  // ship, but nothing stops a theme author from dropping a .tsx component
  // and hydrating it with a client: directive — Astro islands mean it costs
  // nothing on a page that never uses one.
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
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
