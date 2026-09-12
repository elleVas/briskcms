import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Media } from '@brisk/domain-core';
import {
  type BriskDb,
  createAppDb,
  deleteIntegrationTenants,
  sites,
  tenants,
  withTenant,
} from '@brisk/postgres-db';
import { DrizzleMediaRepository } from './drizzle-media.repository';

/**
 * Runs against a real Postgres — see docs/development.md. Connects as
 * `brisk_app`, same as production code, so this is also the RLS regression
 * test for `media`.
 */
describe('DrizzleMediaRepository (integration)', () => {
  let db: BriskDb;
  let mediaRepository: DrizzleMediaRepository;
  let tenantAId: string;
  let tenantBId: string;
  let siteAId: string;

  beforeAll(async () => {
    db = createAppDb();
    mediaRepository = new DrizzleMediaRepository(db);

    const [tenantA] = await db
      .insert(tenants)
      .values({ name: `Integration Tenant A ${randomUUID()}` })
      .returning({ id: tenants.id });
    const [tenantB] = await db
      .insert(tenants)
      .values({ name: `Integration Tenant B ${randomUUID()}` })
      .returning({ id: tenants.id });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const [siteA] = await withTenant(db, tenantAId, (tx) =>
      tx
        .insert(sites)
        .values({ tenantId: tenantAId, name: 'Site A', defaultLocale: 'it' })
        .returning({ id: sites.id }),
    );
    siteAId = siteA.id;
  });

  afterAll(async () => {
    await deleteIntegrationTenants(db, [tenantAId, tenantBId]);
    await db.$client.end();
  });

  function buildMedia(
    overrides: Partial<Parameters<typeof Media.create>[0]> = {},
  ) {
    return Media.create({
      id: randomUUID(),
      tenantId: tenantAId,
      siteId: siteAId,
      filename: 'foto.jpg',
      storageKey: `${randomUUID()}.webp`,
      storageProvider: 'local',
      mimeType: 'image/webp',
      size: 12345,
      width: 800,
      height: 600,
      ...overrides,
    });
  }

  it('saves and retrieves media by id, scoped to its tenant', async () => {
    const item = buildMedia();
    await mediaRepository.save(item);

    const found = await mediaRepository.findById(tenantAId, item.id);
    expect(found?.filename).toBe('foto.jpg');
    expect(found?.storageKey).toBe(item.storageKey);

    const foundFromOtherTenant = await mediaRepository.findById(
      tenantBId,
      item.id,
    );
    expect(foundFromOtherTenant).toBeNull();
  });

  it('listBySite paginates, newest first, scoped to tenant and site', async () => {
    const uniqueSite = randomUUID();
    const [siteForList] = await withTenant(db, tenantAId, (tx) =>
      tx
        .insert(sites)
        .values({
          tenantId: tenantAId,
          name: `Site for list ${uniqueSite}`,
          defaultLocale: 'it',
        })
        .returning({ id: sites.id }),
    );

    const items = [];
    for (let i = 0; i < 3; i++) {
      const item = buildMedia({
        siteId: siteForList.id,
        filename: `foto-${i}.jpg`,
      });
      await mediaRepository.save(item);
      items.push(item);
    }

    const firstPage = await mediaRepository.listBySite(
      tenantAId,
      siteForList.id,
      {
        page: 1,
        pageSize: 2,
      },
    );
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.total).toBe(3);
    // Newest first: the last one saved comes back first.
    expect(firstPage.items[0].filename).toBe('foto-2.jpg');

    const fromOtherTenant = await mediaRepository.listBySite(
      tenantBId,
      siteForList.id,
      { page: 1, pageSize: 10 },
    );
    expect(fromOtherTenant.items).toHaveLength(0);
  });

  /**
   * The library is paginated, so a search has to be answered HERE. Filtering
   * the page that came back would look at the newest twenty-four files and
   * say nothing about the rest, which is worse than no search at all.
   */
  it('listBySite narrows by name and by kind, and stays inside the tenant', async () => {
    const [siteForFilter] = await withTenant(db, tenantAId, (tx) =>
      tx
        .insert(sites)
        .values({
          tenantId: tenantAId,
          name: `Site for filter ${randomUUID()}`,
          defaultLocale: 'it',
        })
        .returning({ id: sites.id }),
    );

    for (const [filename, mimeType] of [
      ['Report finale.png', 'image/webp'],
      ['report_2026.png', 'image/webp'],
      ['reportX2026.png', 'image/webp'],
      ['intervista.mp4', 'video/mp4'],
      ['jingle.mp3', 'audio/mpeg'],
    ] as const) {
      await mediaRepository.save(
        buildMedia({ siteId: siteForFilter.id, filename, mimeType }),
      );
    }

    const page = { page: 1, pageSize: 50 };
    const names = async (
      filter: Parameters<typeof mediaRepository.listBySite>[3],
    ) =>
      (
        await mediaRepository.listBySite(
          tenantAId,
          siteForFilter.id,
          page,
          filter,
        )
      ).items
        .map((item) => item.filename)
        .sort();

    // Case-insensitive, and anywhere in the name.
    expect(await names({ search: 'report' })).toEqual([
      'Report finale.png',
      'reportX2026.png',
      'report_2026.png',
    ]);

    // The underscore is a LIKE wildcard. Unescaped, this would also match
    // "reportX2026.png" — a search for one file that quietly returns two.
    expect(await names({ search: 'report_2026' })).toEqual(['report_2026.png']);

    // The kind comes off the stored MIME type's own prefix, which is what
    // the sniffer decided the bytes really were (ADR-0054).
    expect(await names({ kind: 'video' })).toEqual(['intervista.mp4']);
    expect(await names({ kind: 'audio' })).toEqual(['jingle.mp3']);
    expect(await names({ kind: 'image' })).toHaveLength(3);

    // Both at once, and the count reflects the filter rather than the site.
    const narrowed = await mediaRepository.listBySite(
      tenantAId,
      siteForFilter.id,
      page,
      { search: 'report', kind: 'image' },
    );
    expect(narrowed.total).toBe(3);

    // A filter is not a way round RLS.
    const fromOtherTenant = await mediaRepository.listBySite(
      tenantBId,
      siteForFilter.id,
      page,
      { search: 'report' },
    );
    expect(fromOtherTenant.items).toHaveLength(0);
  });

  it('save() upserts: a second save updates the same row instead of inserting a new one', async () => {
    const item = buildMedia();
    await mediaRepository.save(item);

    const updated = Media.fromProps({
      ...item.toProps(),
      filename: 'nuovo-nome.jpg',
    });
    await mediaRepository.save(updated);

    const found = await mediaRepository.findById(tenantAId, item.id);
    expect(found?.filename).toBe('nuovo-nome.jpg');
  });

  it('deletes media, scoped to tenant', async () => {
    const item = buildMedia();
    await mediaRepository.save(item);

    await mediaRepository.delete(tenantBId, item.id);
    expect(await mediaRepository.findById(tenantAId, item.id)).not.toBeNull();

    await mediaRepository.delete(tenantAId, item.id);
    expect(await mediaRepository.findById(tenantAId, item.id)).toBeNull();
  });
});
