import { describe, expect, it } from 'vitest';
import { Site, SiteLayoutSection } from '@brisk/domain-core';
import { getPublishedSiteChrome } from './get-published-site-chrome.use-case.js';
import {
  InMemorySiteLayoutSectionRepository,
  InMemorySiteRepository,
  InMemorySiteThemeBlockStylesRepository,
} from './in-memory-repositories.test-fixture.js';

describe('getPublishedSiteChrome', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const siteRepository = new InMemorySiteRepository();
    const siteLayoutSectionRepository =
      new InMemorySiteLayoutSectionRepository();
    const siteThemeBlockStylesRepository =
      new InMemorySiteThemeBlockStylesRepository();
    return {
      siteRepository,
      siteLayoutSectionRepository,
      siteThemeBlockStylesRepository,
    };
  }

  function seedSite(siteRepository: InMemorySiteRepository) {
    return siteRepository.save(
      Site.fromProps({
        id: 'site-1',
        tenantId,
        name: 'Sito di prova',
        domain: 'example.com',
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
        createdAt: new Date(),
      }),
    );
  }

  it('returns null for a domain that matches no site — no page lookup needed at all', async () => {
    const deps = setup();

    const result = await getPublishedSiteChrome(deps, {
      tenantId,
      domain: 'nope.example.com',
      locale: 'it',
    });

    expect(result).toBeNull();
  });

  it('returns the site plus header/footer, with no page in the picture', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    const header = SiteLayoutSection.create({
      id: 'header-1',
      tenantId,
      siteId: 'site-1',
      locale: 'it',
      kind: 'header',
    });
    header.saveDraft([{ type: 'Header', props: {} }]);
    header.publish();
    await deps.siteLayoutSectionRepository.save(header);

    const result = await getPublishedSiteChrome(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
    });

    expect(result?.header).toEqual([{ type: 'Header', props: {} }]);
    expect(result?.footer).toBeNull();
    expect(result?.site.name).toBe('Sito di prova');
  });

  it('returns null header/footer when neither has ever been configured for this locale', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const result = await getPublishedSiteChrome(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
    });

    expect(result?.header).toBeNull();
    expect(result?.footer).toBeNull();
    expect(result?.headerSticky).toBe(false);
  });
});
