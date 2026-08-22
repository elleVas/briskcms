import { describe, expect, it } from 'vitest';
import { Site, SiteNotFoundError } from '@brisk/domain-core';
import { InMemorySiteRepository } from './in-memory-repositories.test-fixture.js';
import { updateSiteThemeTokens } from './update-site-theme-tokens.use-case.js';

describe('updateSiteThemeTokens', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const siteRepository = new InMemorySiteRepository();
    return { siteRepository };
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
      themeTokens: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    await deps.siteRepository.save(site);
    return site;
  }

  it('saves the buttons category', async () => {
    const deps = setup();
    await createSite(deps);

    const result = await updateSiteThemeTokens(deps, {
      tenantId,
      siteId: 'site-1',
      tokens: {
        buttons: {
          borderRadius: '9999px',
          paddingX: '1.5rem',
          paddingY: '0.75rem',
        },
      },
    });

    expect(result.themeTokens).toEqual({
      buttons: {
        borderRadius: '9999px',
        paddingX: '1.5rem',
        paddingY: '0.75rem',
      },
    });
    const persisted = await deps.siteRepository.findById(tenantId, 'site-1');
    expect(persisted?.themeTokens).toEqual(result.themeTokens);
  });

  it('throws SiteNotFoundError for a nonexistent site', async () => {
    const deps = setup();

    await expect(
      updateSiteThemeTokens(deps, {
        tenantId,
        siteId: 'does-not-exist',
        tokens: {
          buttons: { borderRadius: '6px', paddingX: null, paddingY: null },
        },
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });
});
