import { describe, expect, it } from 'vitest';
import { Page, PageNotFoundError } from '@brisk/domain-core';
import { getPageBySlug } from './get-page-by-slug.use-case.js';
import { InMemoryPageRepository } from './in-memory-repositories.test-fixture.js';

const tenantId = 'tenant-1';

describe('getPageBySlug', () => {
  it('returns the page matching tenant, site, locale and slug', async () => {
    const pageRepository = new InMemoryPageRepository();
    const page = Page.create({
      id: 'page-1',
      tenantId,
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      seoMeta: { title: 'Chi siamo', description: '' },
    });
    await pageRepository.save(page);

    const found = await getPageBySlug(
      { pageRepository },
      { tenantId, siteId: 'site-1', locale: 'it', slug: 'chi-siamo' },
    );

    expect(found.id).toBe('page-1');
  });

  it('throws PageNotFoundError for a slug that does not exist', async () => {
    const pageRepository = new InMemoryPageRepository();

    await expect(
      getPageBySlug(
        { pageRepository },
        { tenantId, siteId: 'site-1', locale: 'it', slug: 'does-not-exist' },
      ),
    ).rejects.toThrow(PageNotFoundError);
  });
});
