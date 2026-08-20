import { describe, expect, it } from 'vitest';
import { Site } from '@brisk/domain-core';
import { searchPages } from './search-pages.use-case.js';
import {
  InMemorySearchPort,
  InMemorySiteRepository,
} from './in-memory-repositories.test-fixture.js';

describe('searchPages', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const siteRepository = new InMemorySiteRepository();
    const searchPort = new InMemorySearchPort();
    return { siteRepository, searchPort };
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
        searchEngineIndexingEnabled: true,
        themePrimaryColor: null,
        themeSecondaryColor: null,
        themeFontFamily: null,
        themeCustomCss: null,
        themeHeadScript: null,
        themeBodyScript: null,
        themeFaviconUrl: null,
        createdAt: new Date(),
      }),
    );
  }

  it('returns null for a domain that matches no site', async () => {
    const deps = setup();

    const result = await searchPages(deps, {
      tenantId,
      domain: 'nope.example.com',
      locale: 'it',
      query: 'idraulico',
    });

    expect(result).toBeNull();
  });

  it("delegates to searchPort with the domain's resolved site id", async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);
    deps.searchPort.results = [
      {
        pageId: 'page-1',
        slug: 'idraulica',
        title: 'Idraulico',
        excerpt: '...',
      },
    ];

    const result = await searchPages(deps, {
      tenantId,
      domain: 'example.com',
      locale: 'it',
      query: 'idraulico',
    });

    expect(result).toEqual([
      {
        pageId: 'page-1',
        slug: 'idraulica',
        title: 'Idraulico',
        excerpt: '...',
      },
    ]);
  });
});
