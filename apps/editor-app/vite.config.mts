/// <reference types='vitest' />
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

const ENV_DIR = '../../';
// loadEnv() resolves its envDir against process.cwd(), unlike Vite's own
// `envDir` config option which resolves against the project root — so it
// needs an absolute path here, not the same relative string used below.
const ABSOLUTE_ENV_DIR = path.resolve(import.meta.dirname, ENV_DIR);

// Vite's built-in index.html %ENV_VAR% replacement is a plain string
// substitution, so it can't strip VITE_API_URL's "/api" path down to just
// an origin. CSP source-expression path matching is inconsistent enough
// across browsers (MDN recommends avoiding paths in source expressions
// entirely) that connect-src/img-src should allow the whole API origin
// rather than trying to pin an exact "/api" path. This plugin derives
// %API_ORIGIN% (deliberately not VITE_-prefixed, so Vite's own env-var
// substitution ignores it instead of warning it's undefined) from the same
// VITE_API_URL so there's still one source of truth, not a second env var
// to keep in sync by hand.
function cspApiOriginPlugin(mode: string): Plugin {
  const env = loadEnv(mode, ABSOLUTE_ENV_DIR, '');
  const origin = new URL(env.VITE_API_URL).origin;
  return {
    name: 'csp-api-origin',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replaceAll('%API_ORIGIN%', origin);
      },
    },
  };
}

export default defineConfig(({ mode }) => ({
  root: import.meta.dirname,
  // VITE_-prefixed vars live in the repo-root .env, same as everywhere else.
  envDir: ENV_DIR,
  cacheDir: '../../node_modules/.vite/apps/editor-app',
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
  server: {
    port: 4200,
    host: 'localhost',
  },
  preview: {
    port: 4200,
    host: 'localhost',
  },
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    cspApiOriginPlugin(mode),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: '@brisk/editor-app',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.spec.{ts,tsx}',
        'src/main.tsx',
        'src/test-setup.ts',
        'src/routeTree.gen.ts',
      ],
      thresholds: {
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60,
      },
    },
  },
}));
