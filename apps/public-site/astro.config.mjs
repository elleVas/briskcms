// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

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
});
