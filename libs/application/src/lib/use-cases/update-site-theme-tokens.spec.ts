import { describe, expect, it } from 'vitest';
import { Site, SiteNotFoundError } from '@brisk/domain-core';
import {
  InMemorySiteRepository,
  InMemorySiteThemeBlockStylesRepository,
} from './in-memory-repositories.test-fixture.js';
import { updateSiteThemeTokens } from './update-site-theme-tokens.use-case.js';

describe('updateSiteThemeTokens', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const siteRepository = new InMemorySiteRepository();
    const siteThemeBlockStylesRepository =
      new InMemorySiteThemeBlockStylesRepository();
    return { siteRepository, siteThemeBlockStylesRepository };
  }

  async function createSite(deps: ReturnType<typeof setup>) {
    const site = Site.fromProps({
      id: 'site-1',
      tenantId,
      name: 'Il mio sito',
      domain: null,
      defaultLocale: 'it',
      enabledLocales: ['it'],
      untranslatedPageFallback: 'redirect-to-default',
      businessAddress: null,
      businessPhone: null,
      businessType: null,
      openingHours: null,
      searchEngineIndexingEnabled: false,
      themePrimaryColor: null,
      themeSecondaryColor: null,
      themeFontFamily: null,
      themeCustomCss: null,
      themeHeadScript: null,
      themeBodyScript: null,
      themeFaviconUrl: null,
      themeOverridesEnabled: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    await deps.siteRepository.save(site);
    return site;
  }

  it('saves the override for the given block type', async () => {
    const deps = setup();
    await createSite(deps);

    await updateSiteThemeTokens(deps, {
      tenantId,
      siteId: 'site-1',
      blockType: 'Button',
      style: {
        borderRadius: '9999px',
        paddingX: '1.5rem',
        paddingY: '0.75rem',
      },
    });

    const persisted = await deps.siteThemeBlockStylesRepository.listBySite(
      tenantId,
      'site-1',
    );
    expect(persisted).toEqual({
      Button: {
        borderRadius: '9999px',
        paddingX: '1.5rem',
        paddingY: '0.75rem',
      },
    });
  });

  it('leaves other block types untouched', async () => {
    const deps = setup();
    await createSite(deps);
    await deps.siteThemeBlockStylesRepository.upsert(
      tenantId,
      'site-1',
      'Banner',
      {
        backgroundColor: '#000000',
      },
    );

    await updateSiteThemeTokens(deps, {
      tenantId,
      siteId: 'site-1',
      blockType: 'Button',
      style: { borderRadius: '9999px' },
    });

    const persisted = await deps.siteThemeBlockStylesRepository.listBySite(
      tenantId,
      'site-1',
    );
    expect(persisted).toEqual({
      Banner: { backgroundColor: '#000000' },
      Button: { borderRadius: '9999px' },
    });
  });

  it('throws SiteNotFoundError for a nonexistent site', async () => {
    const deps = setup();

    await expect(
      updateSiteThemeTokens(deps, {
        tenantId,
        siteId: 'does-not-exist',
        blockType: 'Button',
        style: { borderRadius: '6px' },
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });
});
