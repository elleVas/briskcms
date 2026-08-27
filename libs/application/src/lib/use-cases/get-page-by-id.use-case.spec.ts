import { describe, expect, it } from 'vitest';
import { Page, PageNotFoundError } from '@brisk/domain-core';
import { getPageById } from './get-page-by-id.use-case.js';
import { InMemoryPageRepository } from './in-memory-repositories.test-fixture.js';

const tenantId = 'tenant-1';

describe('getPageById', () => {
  it('returns the page scoped to its tenant', async () => {
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

    const found = await getPageById(
      { pageRepository },
      { tenantId, pageId: 'page-1' },
    );

    expect(found.id).toBe('page-1');
  });

  it('throws PageNotFoundError for an id that does not exist', async () => {
    const pageRepository = new InMemoryPageRepository();

    await expect(
      getPageById({ pageRepository }, { tenantId, pageId: 'does-not-exist' }),
    ).rejects.toThrow(PageNotFoundError);
  });

  it('throws PageNotFoundError for a page belonging to a different tenant', async () => {
    const pageRepository = new InMemoryPageRepository();
    const page = Page.create({
      id: 'page-1',
      tenantId: 'other-tenant',
      siteId: 'site-1',
      groupId: 'group-1',
      locale: 'it',
      slug: 'chi-siamo',
      seoMeta: { title: 'Chi siamo', description: '' },
    });
    await pageRepository.save(page);

    await expect(
      getPageById({ pageRepository }, { tenantId, pageId: 'page-1' }),
    ).rejects.toThrow(PageNotFoundError);
  });
});
