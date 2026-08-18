import { describe, expect, it } from 'vitest';
import { PageNotFoundError, SiteNotFoundError, Site } from '@brisk/domain-core';
import { createPage } from './create-page.use-case.js';
import { updateSeoMeta } from './update-seo-meta.use-case.js';
import { updateSiteBusinessInfo } from './update-site-business-info.use-case.js';
import { updateSiteGeneralSettings } from './update-site-general-settings.use-case.js';
import { updateSiteSeoSettings } from './update-site-seo-settings.use-case.js';
import {
  InMemoryPageRepository,
  InMemoryPageVersionRepository,
  InMemorySiteRepository,
} from './in-memory-repositories.test-fixture.js';

describe('updateSeoMeta', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const pageRepository = new InMemoryPageRepository();
    const pageVersionRepository = new InMemoryPageVersionRepository();
    return { pageRepository, pageVersionRepository };
  }

  it('replaces a page seoMeta without touching its content', async () => {
    const deps = setup();
    const page = await createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      seoMeta: { title: 'Chi siamo', description: '' },
      content: [{ type: 'Text', props: { body: 'ciao' } }],
      createdBy: 'user-1',
    });

    const updated = await updateSeoMeta(deps, {
      tenantId,
      pageId: page.id,
      seoMeta: {
        title: 'Chi siamo - La nostra storia',
        description: 'Scopri chi siamo',
        canonical: 'https://example.com/chi-siamo',
      },
    });

    expect(updated.seoMeta).toEqual({
      title: 'Chi siamo - La nostra storia',
      description: 'Scopri chi siamo',
      canonical: 'https://example.com/chi-siamo',
    });
    expect(updated.content).toEqual([
      { type: 'Text', props: { body: 'ciao' } },
    ]);
  });

  it('throws PageNotFoundError for a nonexistent page', async () => {
    const deps = setup();

    await expect(
      updateSeoMeta(deps, {
        tenantId,
        pageId: 'does-not-exist',
        seoMeta: { title: 'x', description: '' },
      }),
    ).rejects.toThrow(PageNotFoundError);
  });
});

describe('updateSiteBusinessInfo', () => {
  const tenantId = 'tenant-1';
  const otherTenantId = 'tenant-2';

  function setup() {
    const siteRepository = new InMemorySiteRepository();
    return { siteRepository };
  }

  async function seedSite(siteRepository: InMemorySiteRepository) {
    const site = Site.fromProps({
      id: 'site-1',
      tenantId,
      name: 'Il mio ristorante',
      domain: 'example.com',
      defaultLocale: 'it',
      enabledLocales: ['it'],
      businessAddress: null,
      businessPhone: null,
      businessType: null,
      openingHours: null,
      searchEngineIndexingEnabled: false,
      createdAt: new Date(),
    });
    await siteRepository.save(site);
    return site;
  }

  it('sets the business fields on the site', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const updated = await updateSiteBusinessInfo(deps, {
      tenantId,
      siteId: 'site-1',
      businessAddress: 'Via Roma 1, Milano',
      businessPhone: '+39 02 1234567',
      businessType: 'Restaurant',
      openingHours: [
        {
          dayOfWeek: 'monday',
          ranges: [{ opens: '12:00', closes: '15:00' }],
        },
      ],
    });

    expect(updated.businessAddress).toBe('Via Roma 1, Milano');
    expect(updated.hasBusinessInfo()).toBe(true);
  });

  it('throws SiteNotFoundError for a nonexistent site', async () => {
    const deps = setup();

    await expect(
      updateSiteBusinessInfo(deps, {
        tenantId,
        siteId: 'does-not-exist',
        businessAddress: null,
        businessPhone: null,
        businessType: null,
        openingHours: null,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('does not update a site belonging to a different tenant', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    await expect(
      updateSiteBusinessInfo(deps, {
        tenantId: otherTenantId,
        siteId: 'site-1',
        businessAddress: 'Somewhere else',
        businessPhone: null,
        businessType: null,
        openingHours: null,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });
});

describe('updateSiteGeneralSettings', () => {
  const tenantId = 'tenant-1';
  const otherTenantId = 'tenant-2';

  function setup() {
    const siteRepository = new InMemorySiteRepository();
    return { siteRepository };
  }

  async function seedSite(siteRepository: InMemorySiteRepository) {
    const site = Site.fromProps({
      id: 'site-1',
      tenantId,
      name: 'Il mio sito',
      domain: 'localhost',
      defaultLocale: 'it',
      enabledLocales: ['it'],
      businessAddress: null,
      businessPhone: null,
      businessType: null,
      openingHours: null,
      searchEngineIndexingEnabled: false,
      createdAt: new Date(),
    });
    await siteRepository.save(site);
    return site;
  }

  it('sets the name and domain', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const updated = await updateSiteGeneralSettings(deps, {
      tenantId,
      siteId: 'site-1',
      name: 'Il mio ristorante',
      domain: 'ilmioristorante.it',
    });

    expect(updated.name).toBe('Il mio ristorante');
    expect(updated.domain).toBe('ilmioristorante.it');
  });

  it('throws SiteNotFoundError for a nonexistent site', async () => {
    const deps = setup();

    await expect(
      updateSiteGeneralSettings(deps, {
        tenantId,
        siteId: 'does-not-exist',
        name: 'x',
        domain: null,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('does not update a site belonging to a different tenant', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    await expect(
      updateSiteGeneralSettings(deps, {
        tenantId: otherTenantId,
        siteId: 'site-1',
        name: 'hijacked',
        domain: 'hijacked.example.com',
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });
});

describe('updateSiteSeoSettings', () => {
  const tenantId = 'tenant-1';
  const otherTenantId = 'tenant-2';

  function setup() {
    const siteRepository = new InMemorySiteRepository();
    return { siteRepository };
  }

  async function seedSite(siteRepository: InMemorySiteRepository) {
    const site = Site.fromProps({
      id: 'site-1',
      tenantId,
      name: 'Il mio sito',
      domain: 'localhost',
      defaultLocale: 'it',
      enabledLocales: ['it'],
      businessAddress: null,
      businessPhone: null,
      businessType: null,
      openingHours: null,
      searchEngineIndexingEnabled: false,
      createdAt: new Date(),
    });
    await siteRepository.save(site);
    return site;
  }

  it('enables search engine indexing', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    const updated = await updateSiteSeoSettings(deps, {
      tenantId,
      siteId: 'site-1',
      searchEngineIndexingEnabled: true,
    });

    expect(updated.searchEngineIndexingEnabled).toBe(true);
  });

  it('throws SiteNotFoundError for a nonexistent site', async () => {
    const deps = setup();

    await expect(
      updateSiteSeoSettings(deps, {
        tenantId,
        siteId: 'does-not-exist',
        searchEngineIndexingEnabled: true,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });

  it('does not update a site belonging to a different tenant', async () => {
    const deps = setup();
    await seedSite(deps.siteRepository);

    await expect(
      updateSiteSeoSettings(deps, {
        tenantId: otherTenantId,
        siteId: 'site-1',
        searchEngineIndexingEnabled: true,
      }),
    ).rejects.toThrow(SiteNotFoundError);
  });
});
