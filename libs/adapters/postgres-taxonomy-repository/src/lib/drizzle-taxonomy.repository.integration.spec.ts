import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Taxonomy, Term } from '@brisk/domain-core';
import {
  createAppDb,
  deleteIntegrationTenants,
  pageGroups,
  sites,
  tenants,
  withTenant,
  type BriskDb,
} from '@brisk/postgres-db';
import { DrizzleTaxonomyRepository } from './drizzle-taxonomy.repository';

/**
 * Runs against a real Postgres — see docs/development.md. Connects as
 * `brisk_app`, exactly as production does, so this is also the RLS
 * regression test for the four taxonomy tables: their policy is only
 * worth anything because the migration that created it ran as a
 * different role from the one querying here.
 */
describe('DrizzleTaxonomyRepository (integration)', () => {
  let db: BriskDb;
  let repository: DrizzleTaxonomyRepository;
  let tenantAId: string;
  let tenantBId: string;
  let siteAId: string;

  beforeAll(async () => {
    db = createAppDb();
    repository = new DrizzleTaxonomyRepository(db);
    const [tenantA] = await db
      .insert(tenants)
      .values({ name: `Taxonomy Tenant A ${randomUUID()}` })
      .returning({ id: tenants.id });
    const [tenantB] = await db
      .insert(tenants)
      .values({ name: `Taxonomy Tenant B ${randomUUID()}` })
      .returning({ id: tenants.id });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;
    const [site] = await withTenant(db, tenantAId, (tx) =>
      tx
        .insert(sites)
        .values({
          tenantId: tenantAId,
          name: 'Taxonomy site',
          defaultLocale: 'it',
        })
        .returning({ id: sites.id }),
    );
    siteAId = site.id;
  });

  afterAll(async () => {
    await deleteIntegrationTenants(db, [tenantAId, tenantBId]);
    await db.$client.end();
  });

  function newTaxonomy(prefix: string | null): Taxonomy {
    return Taxonomy.create({
      id: randomUUID(),
      tenantId: tenantAId,
      siteId: siteAId,
      prefix,
      name: { it: 'Categoria', en: 'Category' },
    });
  }

  function newTerm(
    taxonomy: Taxonomy,
    slugs: Record<string, string>,
    parentId?: string,
  ): Term {
    return Term.create({
      id: randomUUID(),
      tenantId: tenantAId,
      siteId: siteAId,
      taxonomyId: taxonomy.id,
      parentId: parentId ?? null,
      name: { it: 'Espresso' },
      slugs,
    });
  }

  it('round-trips a dimension, prefix and all', async () => {
    const taxonomy = newTaxonomy(`categoria-${randomUUID().slice(0, 8)}`);
    await repository.saveTaxonomy(taxonomy);

    const loaded = await repository.findTaxonomyById(tenantAId, taxonomy.id);

    expect(loaded?.prefix).toBe(taxonomy.prefix);
    expect(loaded?.name).toEqual({ it: 'Categoria', en: 'Category' });
    expect(loaded?.hierarchical).toBe(true);
  });

  it('round-trips a term with one address per language', async () => {
    const taxonomy = newTaxonomy(`c-${randomUUID().slice(0, 8)}`);
    await repository.saveTaxonomy(taxonomy);
    const suffix = randomUUID().slice(0, 8);
    const term = newTerm(taxonomy, {
      it: `macchine-${suffix}`,
      en: `machines-${suffix}`,
    });

    await repository.saveTerm(term);
    const loaded = await repository.findTermById(tenantAId, term.id);

    expect(loaded?.slugs).toEqual({
      it: `macchine-${suffix}`,
      en: `machines-${suffix}`,
    });
  });

  /*
   * Saving replaces the address rows wholesale rather than merging them:
   * a language dropped from the map is a language the term stops
   * answering in, and a merge would leave that URL alive with nothing
   * choosing it any more.
   */
  it('drops the address of a language removed from the term', async () => {
    const taxonomy = newTaxonomy(`c-${randomUUID().slice(0, 8)}`);
    await repository.saveTaxonomy(taxonomy);
    const suffix = randomUUID().slice(0, 8);
    const term = newTerm(taxonomy, { it: `it-${suffix}`, en: `en-${suffix}` });
    await repository.saveTerm(term);

    term.setSlug('en', null);
    await repository.saveTerm(term);

    const loaded = await repository.findTermById(tenantAId, term.id);
    expect(loaded?.slugs).toEqual({ it: `it-${suffix}` });
  });

  it('finds a term by the address it answers at', async () => {
    const prefix = `c-${randomUUID().slice(0, 8)}`;
    const taxonomy = newTaxonomy(prefix);
    await repository.saveTaxonomy(taxonomy);
    const slug = `espresso-${randomUUID().slice(0, 8)}`;
    const term = newTerm(taxonomy, { it: slug });
    await repository.saveTerm(term);

    const found = await repository.findTermByAddress(
      tenantAId,
      siteAId,
      'it',
      prefix,
      slug,
    );

    expect(found?.id).toBe(term.id);
  });

  /*
   * `is null` is not `= null`. A root-mounted dimension's prefix IS
   * null, so written as an equality this lookup would match nothing —
   * and every root-mounted address would look free, which is precisely
   * where a collision does the most damage.
   */
  it('finds a ROOT-mounted term, whose prefix is null', async () => {
    const taxonomy = newTaxonomy(null);
    await repository.saveTaxonomy(taxonomy);
    const slug = `caffe-${randomUUID().slice(0, 8)}`;
    const term = newTerm(taxonomy, { it: slug });
    await repository.saveTerm(term);

    const found = await repository.findTermByAddress(
      tenantAId,
      siteAId,
      'it',
      null,
      slug,
    );

    expect(found?.id).toBe(term.id);
  });

  it('moves every term of a dimension when its prefix changes', async () => {
    const oldPrefix = `old-${randomUUID().slice(0, 8)}`;
    const taxonomy = newTaxonomy(oldPrefix);
    await repository.saveTaxonomy(taxonomy);
    const slug = `automatiche-${randomUUID().slice(0, 8)}`;
    const term = newTerm(taxonomy, { it: slug });
    await repository.saveTerm(term);
    const nextPrefix = `new-${randomUUID().slice(0, 8)}`;

    taxonomy.setPrefix(nextPrefix);
    await repository.saveTaxonomy(taxonomy);
    await repository.updateTermAddressPrefix(
      tenantAId,
      taxonomy.id,
      nextPrefix,
    );

    expect(
      await repository.findTermByAddress(
        tenantAId,
        siteAId,
        'it',
        nextPrefix,
        slug,
      ),
    ).toBeTruthy();
    expect(
      await repository.findTermByAddress(
        tenantAId,
        siteAId,
        'it',
        taxonomy.prefix === nextPrefix ? 'old-nothing' : 'old-nothing',
        slug,
      ),
    ).toBeNull();
  });

  it('replaces a page group terms rather than adding to them', async () => {
    const taxonomy = newTaxonomy(`c-${randomUUID().slice(0, 8)}`);
    await repository.saveTaxonomy(taxonomy);
    const first = newTerm(taxonomy, { it: `a-${randomUUID().slice(0, 8)}` });
    const second = newTerm(taxonomy, { it: `b-${randomUUID().slice(0, 8)}` });
    await repository.saveTerm(first);
    await repository.saveTerm(second);
    const [group] = await withTenant(db, tenantAId, (tx) =>
      tx
        .insert(pageGroups)
        .values({ tenantId: tenantAId, siteId: siteAId })
        .returning({ id: pageGroups.id }),
    );

    await repository.setTermsForPageGroup(tenantAId, group.id, [
      first.id,
      second.id,
    ]);
    await repository.setTermsForPageGroup(tenantAId, group.id, [second.id]);

    expect(
      await repository.listTermIdsForPageGroup(tenantAId, group.id),
    ).toEqual([second.id]);
    expect(
      await repository.listPageGroupIdsForTerm(tenantAId, second.id),
    ).toEqual([group.id]);
    expect(
      await repository.listPageGroupIdsForTerm(tenantAId, first.id),
    ).toEqual([]);
  });

  it('shows one tenant nothing of another tenant dimensions (RLS)', async () => {
    const taxonomy = newTaxonomy(`c-${randomUUID().slice(0, 8)}`);
    await repository.saveTaxonomy(taxonomy);

    expect(
      await repository.findTaxonomyById(tenantAId, taxonomy.id),
    ).toBeTruthy();
    expect(
      await repository.findTaxonomyById(tenantBId, taxonomy.id),
    ).toBeNull();
  });
});
