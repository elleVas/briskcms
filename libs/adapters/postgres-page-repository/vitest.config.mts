import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { resolve } from 'node:path';

// Loads local dev credentials for the integration tests, which talk to a
// real Postgres (see docs/development.md). CI sets these as job env vars
// instead, so this is a no-op there.
config({ path: resolve(import.meta.dirname, '../../../.env') });

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir:
    '../../../node_modules/.vite/libs/adapters/postgres-page-repository',
  test: {
    name: '@brisk/postgres-page-repository',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
