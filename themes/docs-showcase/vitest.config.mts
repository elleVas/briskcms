import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/themes/docs-showcase',
  test: {
    name: '@brisk/theme-docs-showcase',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['blocks/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    reporters: ['default'],
  },
}));
