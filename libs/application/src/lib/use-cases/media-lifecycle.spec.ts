import { describe, expect, it } from 'vitest';
import { MediaNotFoundError } from '@brisk/domain-core';
import { uploadMedia } from './upload-media.use-case.js';
import { listMedia } from './list-media.use-case.js';
import { deleteMedia } from './delete-media.use-case.js';
import {
  InMemoryMediaRepository,
  InMemoryMediaStorage,
} from './in-memory-repositories.test-fixture.js';

describe('media lifecycle: upload -> list -> delete', () => {
  const tenantId = 'tenant-1';
  const otherTenantId = 'tenant-2';

  function setup() {
    const mediaRepository = new InMemoryMediaRepository();
    const mediaStorage = new InMemoryMediaStorage();
    return { mediaRepository, mediaStorage };
  }

  it('uploads through the storage port and persists the returned metadata', async () => {
    const deps = setup();

    const media = await uploadMedia(deps, {
      tenantId,
      siteId: 'site-1',
      filename: 'foto.png',
      mimeType: 'image/png',
      data: new Uint8Array([1, 2, 3]),
    });

    expect(media.filename).toBe('foto.png');
    expect(media.storageProvider).toBe('local');
    expect(media.mimeType).toBe('image/webp'); // converted, not the input type
    expect(media.width).toBe(800);
    expect(deps.mediaStorage.uploads).toHaveLength(1);
    expect(deps.mediaStorage.uploads[0].filename).toBe('foto.png');

    const found = await deps.mediaRepository.findById(tenantId, media.id);
    expect(found?.storageKey).toBe(media.storageKey);
  });

  it('listMedia paginates and scopes by tenant/site', async () => {
    const deps = setup();
    for (let i = 0; i < 3; i++) {
      await uploadMedia(deps, {
        tenantId,
        siteId: 'site-1',
        filename: `foto-${i}.png`,
        mimeType: 'image/png',
        data: new Uint8Array([i]),
      });
    }
    await uploadMedia(deps, {
      tenantId: otherTenantId,
      siteId: 'site-1',
      filename: 'non-mio.png',
      mimeType: 'image/png',
      data: new Uint8Array([9]),
    });

    const result = await listMedia(deps, {
      tenantId,
      siteId: 'site-1',
      page: 1,
      pageSize: 2,
    });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(3);
  });

  it('deleteMedia removes the stored file and the DB row', async () => {
    const deps = setup();
    const media = await uploadMedia(deps, {
      tenantId,
      siteId: 'site-1',
      filename: 'foto.png',
      mimeType: 'image/png',
      data: new Uint8Array([1]),
    });

    await deleteMedia(deps, { tenantId, mediaId: media.id });

    expect(deps.mediaStorage.deletedKeys).toEqual([media.storageKey]);
    expect(await deps.mediaRepository.findById(tenantId, media.id)).toBeNull();
  });

  it('deleteMedia throws MediaNotFoundError for a nonexistent id', async () => {
    const deps = setup();

    await expect(
      deleteMedia(deps, { tenantId, mediaId: 'does-not-exist' }),
    ).rejects.toThrow(MediaNotFoundError);
  });

  it('deleteMedia does not touch a different tenant', async () => {
    const deps = setup();
    const media = await uploadMedia(deps, {
      tenantId,
      siteId: 'site-1',
      filename: 'foto.png',
      mimeType: 'image/png',
      data: new Uint8Array([1]),
    });

    await expect(
      deleteMedia(deps, { tenantId: otherTenantId, mediaId: media.id }),
    ).rejects.toThrow(MediaNotFoundError);
    expect(
      await deps.mediaRepository.findById(tenantId, media.id),
    ).not.toBeNull();
  });
});
