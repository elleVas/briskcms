import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FilesystemThemeCatalogAdapter } from './filesystem-theme-catalog.adapter';

describe('FilesystemThemeCatalogAdapter', () => {
  let themesDir: string;

  beforeEach(async () => {
    themesDir = await mkdtemp(join(tmpdir(), 'brisk-themes-test-'));
  });

  afterEach(async () => {
    await rm(themesDir, { recursive: true, force: true });
  });

  async function createTheme(name: string, withManifest = true) {
    const dir = join(themesDir, name);
    await mkdir(dir, { recursive: true });
    if (withManifest) {
      await writeFile(
        join(dir, 'theme.json'),
        JSON.stringify({ allowStyleOverrides: true }),
      );
    }
  }

  it('lists every subdirectory that has a theme.json, sorted by name', async () => {
    await createTheme('docs-showcase');
    await createTheme('classic');

    const adapter = new FilesystemThemeCatalogAdapter({ themesDir });
    const result = await adapter.listAvailableThemes();

    expect(result).toEqual([{ name: 'classic' }, { name: 'docs-showcase' }]);
  });

  it('lists a theme symlinked in from outside themesDir', async () => {
    // How an external theme reaches a deployment (docs/adr/0043). readdir
    // reports on the link, not its target, so this used to be invisible to
    // the catalog: the theme rendered but never showed up in the editor's
    // picker, and PATCH /sites/:id/theme-package rejected its name.
    const outside = await mkdtemp(join(tmpdir(), 'brisk-external-theme-'));
    await writeFile(
      join(outside, 'theme.json'),
      JSON.stringify({ allowStyleOverrides: true }),
    );
    await symlink(outside, join(themesDir, 'acme'));
    await createTheme('classic');

    const adapter = new FilesystemThemeCatalogAdapter({ themesDir });
    try {
      expect(await adapter.listAvailableThemes()).toEqual([
        { name: 'acme' },
        { name: 'classic' },
      ]);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('excludes a subdirectory with no theme.json', async () => {
    await createTheme('classic');
    await createTheme('half-built', false);

    const adapter = new FilesystemThemeCatalogAdapter({ themesDir });
    const result = await adapter.listAvailableThemes();

    expect(result).toEqual([{ name: 'classic' }]);
  });

  it('ignores stray files directly under themesDir', async () => {
    await createTheme('classic');
    await writeFile(join(themesDir, 'README.md'), '# themes');

    const adapter = new FilesystemThemeCatalogAdapter({ themesDir });
    const result = await adapter.listAvailableThemes();

    expect(result).toEqual([{ name: 'classic' }]);
  });

  it('returns an empty list for an empty directory', async () => {
    const adapter = new FilesystemThemeCatalogAdapter({ themesDir });
    const result = await adapter.listAvailableThemes();

    expect(result).toEqual([]);
  });
});
