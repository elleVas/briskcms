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

  /*
   * The editor's theme picker is built from this list, and the public
   * site refuses to render anything the same allow-list excludes
   * (ADR-0069). Before this, a client could pick a theme here and get
   * the fallback rendered instead, with no error anywhere.
   */
  it('offers only the themes the allow-list names', async () => {
    await createTheme('classic');
    await createTheme('docs-showcase');
    await createTheme('agency');

    const adapter = new FilesystemThemeCatalogAdapter({
      themesDir,
      allowList: 'agency',
    });

    expect(await adapter.listAvailableThemes()).toEqual([{ name: 'agency' }]);
  });

  it('offers everything when no allow-list is set', async () => {
    await createTheme('classic');
    await createTheme('agency');

    for (const allowList of [undefined, '']) {
      const adapter = new FilesystemThemeCatalogAdapter({
        themesDir,
        allowList,
      });
      expect(await adapter.listAvailableThemes()).toEqual([
        { name: 'agency' },
        { name: 'classic' },
      ]);
    }
  });

  /*
   * A typo, or a theme dropped from a later release: degrading to
   * "everything" keeps the deployment working, where an empty picker
   * would leave a site with no theme it is allowed to choose.
   */
  it('offers everything when the allow-list names nothing that exists', async () => {
    await createTheme('classic');

    const adapter = new FilesystemThemeCatalogAdapter({
      themesDir,
      allowList: 'typo-only',
    });

    expect(await adapter.listAvailableThemes()).toEqual([{ name: 'classic' }]);
  });

  it('returns an empty list for an empty directory', async () => {
    const adapter = new FilesystemThemeCatalogAdapter({ themesDir });
    const result = await adapter.listAvailableThemes();

    expect(result).toEqual([]);
  });
});
