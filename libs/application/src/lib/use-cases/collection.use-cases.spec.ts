import { describe, expect, it } from 'vitest';
import {
  CollectionNotFoundError,
  PageGroup,
  PageGroupNotFoundError,
} from '@brisk/domain-core';
import {
  createCollection,
  deleteCollection,
  listCollections,
  updateCollection,
} from './collection.use-cases';
import { movePageGroupToCollection } from './move-page-group-to-collection.use-case';
import {
  InMemoryCollectionRepository,
  InMemoryPageGroupRepository,
} from './in-memory-repositories.test-fixture';

const tenantId = 'tenant-1';
const siteId = 'site-1';

function setup() {
  return {
    collectionRepository: new InMemoryCollectionRepository(),
    pageGroupRepository: new InMemoryPageGroupRepository(),
  };
}

describe('collections', () => {
  /*
   * A new section goes at the bottom of the sidebar: adding one must not
   * move the entries somebody has learned the position of.
   */
  it('appends a new section after the ones already there', async () => {
    const deps = setup();

    const first = await createCollection(deps, {
      tenantId,
      siteId,
      name: 'News',
    });
    const second = await createCollection(deps, {
      tenantId,
      siteId,
      name: 'Events',
    });

    expect([first.order, second.order]).toEqual([0, 1]);
    const listed = await listCollections(deps, tenantId, siteId);
    expect(listed.map((one) => one.name)).toEqual(['News', 'Events']);
  });

  it('renaming a section keeps everything else', async () => {
    const deps = setup();
    const collection = await createCollection(deps, {
      tenantId,
      siteId,
      name: 'News',
      icon: 'star',
    });

    const renamed = await updateCollection(deps, {
      tenantId,
      collectionId: collection.id,
      name: 'Press',
    });

    expect(renamed.name).toBe('Press');
    expect(renamed.icon).toBe('star');
  });

  it('refuses to touch a section that does not exist', async () => {
    const deps = setup();

    await expect(
      updateCollection(deps, {
        tenantId,
        collectionId: 'missing',
        name: 'Press',
      }),
    ).rejects.toThrow(CollectionNotFoundError);
    await expect(deleteCollection(deps, tenantId, 'missing')).rejects.toThrow(
      CollectionNotFoundError,
    );
  });

  it('sees nothing of another tenant', async () => {
    const deps = setup();
    await createCollection(deps, { tenantId, siteId, name: 'News' });

    expect(await listCollections(deps, 'tenant-2', siteId)).toEqual([]);
  });
});

describe('movePageGroupToCollection', () => {
  async function withPage(deps: ReturnType<typeof setup>) {
    const group = PageGroup.create({ id: 'group-1', tenantId, siteId });
    await deps.pageGroupRepository.save(group);
    return group;
  }

  it('files a page under a section, and takes it back out', async () => {
    const deps = setup();
    await withPage(deps);
    const collection = await createCollection(deps, {
      tenantId,
      siteId,
      name: 'News',
    });

    const filed = await movePageGroupToCollection(deps, {
      tenantId,
      pageGroupId: 'group-1',
      collectionId: collection.id,
      actorUserId: 'user-1',
    });
    expect(filed.collectionId).toBe(collection.id);
    expect(filed.updatedBy).toBe('user-1');

    const back = await movePageGroupToCollection(deps, {
      tenantId,
      pageGroupId: 'group-1',
      collectionId: null,
      actorUserId: 'user-1',
    });
    expect(back.collectionId).toBeNull();
  });

  /*
   * A page pointing at a section that does not exist would simply vanish
   * from every screen, which is the worst way to lose something.
   */
  it('refuses a section that does not exist, leaving the page where it was', async () => {
    const deps = setup();
    await withPage(deps);

    await expect(
      movePageGroupToCollection(deps, {
        tenantId,
        pageGroupId: 'group-1',
        collectionId: 'missing',
        actorUserId: null,
      }),
    ).rejects.toThrow(CollectionNotFoundError);
    const group = await deps.pageGroupRepository.findById(tenantId, 'group-1');
    expect(group?.collectionId).toBeNull();
  });

  it('refuses a page that does not exist', async () => {
    const deps = setup();

    await expect(
      movePageGroupToCollection(deps, {
        tenantId,
        pageGroupId: 'missing',
        collectionId: null,
        actorUserId: null,
      }),
    ).rejects.toThrow(PageGroupNotFoundError);
  });
});
