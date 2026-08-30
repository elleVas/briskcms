import { describe, expect, it } from 'vitest';
import {
  PageHierarchyCycleError,
  PageHierarchyLocaleMismatchError,
  PageNotFoundError,
} from '@brisk/domain-core';
import { createPage } from './create-page.use-case';
import { setPageParent } from './set-page-parent.use-case';
import {
  InMemoryPageRepository,
  InMemoryPageVersionRepository,
} from './in-memory-repositories.test-fixture';

describe('setPageParent', () => {
  const tenantId = 'tenant-1';

  function setup() {
    return {
      pageRepository: new InMemoryPageRepository(),
      pageVersionRepository: new InMemoryPageVersionRepository(),
    };
  }

  // setPageParent itself only depends on pageRepository — the version
  // repository below is only needed because createPage (reused to seed
  // pages for these tests) writes a page_versions row on every create.
  async function makePage(
    deps: ReturnType<typeof setup>,
    overrides: {
      groupId: string;
      slug: string;
      siteId?: string;
      locale?: string;
    },
  ) {
    return createPage(deps, {
      tenantId,
      siteId: overrides.siteId ?? 'site-1',
      groupId: overrides.groupId,
      locale: overrides.locale ?? 'it',
      slug: overrides.slug,
      seoMeta: { title: overrides.slug, description: '' },
      createdBy: 'user-1',
    });
  }

  it('reassigns the parent when it is a valid sibling in the same site and locale', async () => {
    const deps = setup();
    const servizi = await makePage(deps, {
      groupId: 'group-servizi',
      slug: 'servizi',
    });
    const idraulica = await makePage(deps, {
      groupId: 'group-idraulica',
      slug: 'idraulica',
    });

    const result = await setPageParent(deps, {
      tenantId,
      pageId: idraulica.id,
      parentId: servizi.id,
    });

    expect(result.parentId).toBe(servizi.id);
  });

  it('clears the parent back to root when passed null', async () => {
    const deps = setup();
    const servizi = await makePage(deps, {
      groupId: 'group-servizi',
      slug: 'servizi',
    });
    const idraulica = await makePage(deps, {
      groupId: 'group-idraulica',
      slug: 'idraulica',
    });
    await setPageParent(deps, {
      tenantId,
      pageId: idraulica.id,
      parentId: servizi.id,
    });

    const result = await setPageParent(deps, {
      tenantId,
      pageId: idraulica.id,
      parentId: null,
    });

    expect(result.parentId).toBeNull();
  });

  it('throws PageNotFoundError for an unknown page', async () => {
    const deps = setup();

    await expect(
      setPageParent(deps, {
        tenantId,
        pageId: 'missing',
        parentId: null,
      }),
    ).rejects.toBeInstanceOf(PageNotFoundError);
  });

  it('throws PageNotFoundError for an unknown proposed parent', async () => {
    const deps = setup();
    const page = await makePage(deps, {
      groupId: 'group-1',
      slug: 'chi-siamo',
    });

    await expect(
      setPageParent(deps, {
        tenantId,
        pageId: page.id,
        parentId: 'missing',
      }),
    ).rejects.toBeInstanceOf(PageNotFoundError);
  });

  it('rejects a parent in a different site', async () => {
    const deps = setup();
    const otherSitePage = await makePage(deps, {
      groupId: 'group-other',
      slug: 'altrove',
      siteId: 'site-2',
    });
    const page = await makePage(deps, {
      groupId: 'group-1',
      slug: 'chi-siamo',
    });

    await expect(
      setPageParent(deps, {
        tenantId,
        pageId: page.id,
        parentId: otherSitePage.id,
      }),
    ).rejects.toBeInstanceOf(PageHierarchyLocaleMismatchError);
  });

  it('rejects a parent in a different locale', async () => {
    const deps = setup();
    const enPage = await makePage(deps, {
      groupId: 'group-en',
      slug: 'about',
      locale: 'en',
    });
    const page = await makePage(deps, {
      groupId: 'group-1',
      slug: 'chi-siamo',
    });

    await expect(
      setPageParent(deps, {
        tenantId,
        pageId: page.id,
        parentId: enPage.id,
      }),
    ).rejects.toBeInstanceOf(PageHierarchyLocaleMismatchError);
  });

  it('rejects setting a page as its own parent', async () => {
    const deps = setup();
    const page = await makePage(deps, {
      groupId: 'group-1',
      slug: 'chi-siamo',
    });

    await expect(
      setPageParent(deps, {
        tenantId,
        pageId: page.id,
        parentId: page.id,
      }),
    ).rejects.toBeInstanceOf(PageHierarchyCycleError);
  });

  it('rejects a reassignment that would create a cycle further up the chain', async () => {
    const deps = setup();
    const grandparent = await makePage(deps, {
      groupId: 'group-a',
      slug: 'a',
    });
    const parent = await makePage(deps, { groupId: 'group-b', slug: 'b' });
    const child = await makePage(deps, { groupId: 'group-c', slug: 'c' });
    await setPageParent(deps, {
      tenantId,
      pageId: parent.id,
      parentId: grandparent.id,
    });
    await setPageParent(deps, {
      tenantId,
      pageId: child.id,
      parentId: parent.id,
    });

    // a -> b -> c today; making "a"'s parent "c" would close the loop.
    await expect(
      setPageParent(deps, {
        tenantId,
        pageId: grandparent.id,
        parentId: child.id,
      }),
    ).rejects.toBeInstanceOf(PageHierarchyCycleError);
  });
});
