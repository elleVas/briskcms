import { readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { AvailableTheme, ThemeCatalogPort } from '@brisk/ports';

export interface FilesystemThemeCatalogOptions {
  /**
   * Directory containing one subdirectory per theme, each with its own
   * `theme.json` — the repo's real `themes/` in local dev (nx serve's cwd
   * is the repo root), or a manifest-only copy baked into apps/api's own
   * image at build time in production, since the pruned runtime image
   * doesn't otherwise carry `themes/`'s Astro source (docs/adr/0042).
   */
  themesDir: string;
}

/** Scans the filesystem fresh on every call — a deployment doesn't add or remove bundled themes without a rebuild, so there's nothing to cache. */
export class FilesystemThemeCatalogAdapter implements ThemeCatalogPort {
  constructor(private readonly options: FilesystemThemeCatalogOptions) {}

  async listAvailableThemes(): Promise<AvailableTheme[]> {
    const entries = await readdir(this.options.themesDir, {
      withFileTypes: true,
    });
    const themes: AvailableTheme[] = [];

    for (const entry of entries) {
      // Symlinks count. `readdir` reports on the link itself, not its
      // target, so `isDirectory()` alone is false for a theme that lives
      // outside the repo and is linked into `themesDir` — which is exactly
      // how an agency's own theme reaches a deployment (docs/adr/0043).
      // Widening this is safe: the `access` below is what actually decides,
      // and only a directory can have a `theme.json` inside it.
      if (!entry.isDirectory() && !entry.isSymbolicLink()) {
        continue;
      }
      const manifestPath = join(
        this.options.themesDir,
        entry.name,
        'theme.json',
      );
      const hasManifest = await access(manifestPath)
        .then(() => true)
        .catch(() => false);
      if (hasManifest) {
        themes.push({ name: entry.name });
      }
    }

    return themes.sort((a, b) => a.name.localeCompare(b.name));
  }
}
