import { requireEnv } from '@brisk/env-config';
import { FilesystemThemeCatalogAdapter } from '@brisk/filesystem-theme-catalog';
import type { ThemeCatalogPort } from '@brisk/ports';

/**
 * THEMES_DIR: `./themes` (the repo's own themes/ directory, since nx
 * serve's cwd is the repo root) in local dev; `/app/themes` in production,
 * where the Dockerfile copies just each theme's theme.json manifest
 * (docs/adr/0042 — the pruned runtime image doesn't otherwise carry
 * themes/'s Astro source).
 */
export function createThemeCatalog(): ThemeCatalogPort {
  return new FilesystemThemeCatalogAdapter({
    themesDir: requireEnv('THEMES_DIR'),
  });
}
