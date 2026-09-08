import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ReusableSection } from '@brisk/domain-core';
import {
  type BriskDb,
  createAppDb,
  deleteIntegrationTenants,
  sites,
  tenants,
  withTenant,
} from '@brisk/postgres-db';
import { DrizzleReusableSectionRepository } from './drizzle-reusable-section.repository';
import { DrizzleReusableSectionVersionRepository } from './drizzle-reusable-section-version.repository';

/**
 * Runs against a real Postgres — see docs/development.md. Connects as
 * `brisk_app`, exactly as production does, which makes this the RLS
 * regression test for `reusable_sections` too: the policy added with the
 * table (docs/adr/0059) is only worth anything because the migration runs
 * as a different role from the one queried here.
 */
describe('DrizzleReusableSectionRepository (integration)', () => {
  let db: BriskDb;
  let sectionRepository: DrizzleReusableSectionRepository;
  let versionRepository: DrizzleReusableSectionVersionRepository;
  let tenantAId: string;
  let tenantBId: string;
  let siteAId: string;

  beforeAll(async () => {
    db = createAppDb();
    sectionRepository = new DrizzleReusableSectionRepository(db);
    versionRepository = new DrizzleReusableSectionVersionRepository(db);

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

  // A fresh name per call: (tenant, site, name) is unique, so a fixed one
  // would make each test depend on the ones before it.
  function buildSection(
    overrides: Partial<Parameters<typeof ReusableSection.create>[0]> = {},
  ) {
    return ReusableSection.create({
      id: randomUUID(),
      tenantId: tenantAId,
      siteId: siteAId,
      name: `Section ${randomUUID()}`,
      kind: 'shared',
      ...overrides,
    });
  }

  it('saves and retrieves a section by id, scoped to its tenant', async () => {
    const section = buildSection({
      content: [{ id: 'b1', type: 'Heading', props: { text: 'Services' } }],
    });
    await sectionRepository.save(section);

    const found = await sectionRepository.findById(tenantAId, section.id);
    expect(found?.name).toBe(section.name);
    expect(found?.content).toEqual([
      { id: 'b1', type: 'Heading', props: { text: 'Services' } },
    ]);

    // The other tenant does not see it. Not a nicety: this is the claim
    // docs/adr/0002 makes, checked through the same role the app uses.
    expect(await sectionRepository.findById(tenantBId, section.id)).toBeNull();
  });

  it('keeps the draft and the published content apart', async () => {
    const section = buildSection({
      content: [{ id: 'b1', type: 'Text', props: { text: 'first' } }],
    });
    await sectionRepository.save(section);
    section.publish();
    await sectionRepository.save(section);
    section.saveDraft([{ id: 'b1', type: 'Text', props: { text: 'second' } }]);
    await sectionRepository.save(section);

    const found = await sectionRepository.findById(tenantAId, section.id);
    // What pages render is the published half — an edit that has not been
    // published must not reach them (docs/adr/0059).
    expect(found?.publishedContent).toEqual([
      { id: 'b1', type: 'Text', props: { text: 'first' } },
    ]);
    expect(found?.content).toEqual([
      { id: 'b1', type: 'Text', props: { text: 'second' } },
    ]);
  });

  it('reads many sections in one query, refusing another tenant’s ids', async () => {
    const first = buildSection();
    const second = buildSection();
    await sectionRepository.save(first);
    await sectionRepository.save(second);

    const found = await sectionRepository.findByIds(tenantAId, [
      first.id,
      second.id,
      randomUUID(),
    ]);
    expect(found.map((section) => section.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    expect(await sectionRepository.findByIds(tenantBId, [first.id])).toEqual(
      [],
    );
  });

  it('stores which fields an instance may change', async () => {
    const section = buildSection();
    section.setExposedFields({ 'block-1': ['title', 'text'] });
    await sectionRepository.save(section);

    const found = await sectionRepository.findById(tenantAId, section.id);
    expect(found?.exposedFields).toEqual({ 'block-1': ['title', 'text'] });
  });

  it('keeps only the last ten versions', async () => {
    const section = buildSection();
    await sectionRepository.save(section);

    for (let index = 0; index < 12; index += 1) {
      await versionRepository.save({
        id: randomUUID(),
        tenantId: tenantAId,
        reusableSectionId: section.id,
        content: [{ id: 'b1', type: 'Text', props: { text: `v${index}` } }],
        createdBy: null,
        // Distinct timestamps: the prune keeps the newest ten by
        // created_at, and rows written in the same millisecond would make
        // which ten survive a matter of chance.
        createdAt: new Date(Date.now() + index * 1000),
      });
    }

    const versions = await versionRepository.listBySection(
      tenantAId,
      section.id,
    );
    expect(versions).toHaveLength(10);
    // Oldest first, and the two earliest are the ones dropped.
    expect(versions[0]?.content).toEqual([
      { id: 'b1', type: 'Text', props: { text: 'v2' } },
    ]);
  });
});
