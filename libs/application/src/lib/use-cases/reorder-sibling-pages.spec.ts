import { describe, expect, it } from 'vitest';
import { createPage } from './create-page.use-case';
import { reorderSiblingPages } from './reorder-sibling-pages.use-case';
import {
  InMemoryPageRepository,
  InMemoryPageVersionRepository,
} from './in-memory-repositories.test-fixture';

describe('reorderSiblingPages', () => {
  const tenantId = 'tenant-1';

  function setup() {
    const pageVersionRepository = new InMemoryPageVersionRepository();
    const pageRepository = new InMemoryPageRepository(pageVersionRepository);
    return { pageRepository };
  }

  async function create(
    deps: ReturnType<typeof setup>,
    input: { groupId: string; slug: string; parentId?: string | null },
  ) {
    return createPage(deps, {
      tenantId,
      siteId: 'site-1',
      groupId: input.groupId,
      locale: 'it',
      slug: input.slug,
      parentId: input.parentId,
      seoMeta: { title: input.slug, description: '' },
      createdBy: 'user-1',
    });
  }

  it('createPage appends new siblings at the end of the same group, scoped by parentId', async () => {
    const deps = setup();
    const root = await create(deps, { groupId: 'g-root', slug: 'root' });
    const first = await create(deps, { groupId: 'g1', slug: 'a' });
    const second = await create(deps, { groupId: 'g2', slug: 'b' });
    const childOfRoot = await create(deps, {
      groupId: 'g3',
      slug: 'child',
      parentId: root.id,
    });

    // root-level group, in creation order: root, first, second.
    expect(root.order).toBe(0);
    expect(first.order).toBe(1);
    expect(second.order).toBe(2);
    // A different sibling group (root's own children) starts its own
    // sequence from 0, independent of the root-level group's count.
    expect(childOfRoot.order).toBe(0);
  });

  it('reorders a sibling group to match the given id order', async () => {
    const deps = setup();
    const a = await create(deps, { groupId: 'g1', slug: 'a' });
    const b = await create(deps, { groupId: 'g2', slug: 'b' });
    const c = await create(deps, { groupId: 'g3', slug: 'c' });

    await reorderSiblingPages(deps, {
      tenantId,
      siteId: 'site-1',
      locale: 'it',
      parentId: null,
      orderedPageIds: [c.id, a.id, b.id],
    });

    const reordered = await deps.pageRepository.listSiblings(
      tenantId,
      'site-1',
      'it',
      null,
    );
    expect(reordered.map((page) => page.id)).toEqual([c.id, a.id, b.id]);
  });

  it('rejects a reorder that omits a real sibling', async () => {
    const deps = setup();
    const a = await create(deps, { groupId: 'g1', slug: 'a' });
    await create(deps, { groupId: 'g2', slug: 'b' });

    await expect(
      reorderSiblingPages(deps, {
        tenantId,
        siteId: 'site-1',
        locale: 'it',
        parentId: null,
        orderedPageIds: [a.id],
      }),
    ).rejects.toThrow('does not match the actual sibling group');
  });

  it('rejects a reorder that references a page from a different group', async () => {
    const deps = setup();
    const root = await create(deps, { groupId: 'g-root', slug: 'root' });
    const a = await create(deps, { groupId: 'g1', slug: 'a' });
    const childOfRoot = await create(deps, {
      groupId: 'g3',
      slug: 'child',
      parentId: root.id,
    });

    await expect(
      reorderSiblingPages(deps, {
        tenantId,
        siteId: 'site-1',
        locale: 'it',
        parentId: null,
        // childOfRoot isn't part of the root-level group at all.
        orderedPageIds: [a.id, childOfRoot.id],
      }),
    ).rejects.toThrow('does not match the actual sibling group');
  });
});
