import { randomUUID } from 'node:crypto';
import {
  SiteNotFoundError,
  Taxonomy,
  TaxonomyNotFoundError,
  TaxonomyNotHierarchicalError,
  Term,
  TermCycleError,
  TermNotFoundError,
} from '@brisk/domain-core';
import type { LocalizedSeoMeta, LocalizedText } from '@brisk/shared-types';
import { slugify } from '@brisk/shared-types';
import type { SiteRepositoryPort } from '@brisk/ports';
import {
  assertTaxonomyPrefixAvailable,
  assertTermAddressAvailable,
  type TermAddressDeps,
} from './term-address';

/**
 * The taxonomy and term CRUD, in one file for the same reason the
 * reusable-section CRUD is: most of these are load, mutate, save, and
 * the parts that carry real policy — which addresses are free, whether a
 * move would make a term its own ancestor — live in `term-address.ts`
 * and in `assertNoCycle` below, where they can be read on their own.
 */
export interface TaxonomyDeps extends TermAddressDeps {
  siteRepository: SiteRepositoryPort;
}

async function siteLocales(
  deps: TaxonomyDeps,
  tenantId: string,
  siteId: string,
): Promise<string[]> {
  const site = await deps.siteRepository.findById(tenantId, siteId);
  if (!site) {
    throw new SiteNotFoundError(siteId);
  }
  return site.enabledLocales;
}

async function loadTaxonomy(
  deps: TaxonomyDeps,
  tenantId: string,
  id: string,
): Promise<Taxonomy> {
  const taxonomy = await deps.taxonomyRepository.findTaxonomyById(tenantId, id);
  if (!taxonomy) {
    throw new TaxonomyNotFoundError(id);
  }
  return taxonomy;
}

async function loadTerm(
  deps: TaxonomyDeps,
  tenantId: string,
  id: string,
): Promise<Term> {
  const term = await deps.taxonomyRepository.findTermById(tenantId, id);
  if (!term) {
    throw new TermNotFoundError(id);
  }
  return term;
}

export interface CreateTaxonomyInput {
  tenantId: string;
  siteId: string;
  name: LocalizedText;
  /** `null` mounts its terms at the site root. Absent means "derive one from the name", which is what the editor sends. */
  prefix?: string | null;
  hierarchical?: boolean;
}

export async function createTaxonomy(
  deps: TaxonomyDeps,
  input: CreateTaxonomyInput,
): Promise<Taxonomy> {
  const prefix =
    input.prefix === undefined
      ? defaultPrefixFrom(input.name)
      : normalizePrefix(input.prefix);
  await assertTaxonomyPrefixAvailable(deps, {
    tenantId: input.tenantId,
    siteId: input.siteId,
    prefix,
    locales: await siteLocales(deps, input.tenantId, input.siteId),
  });

  const taxonomy = Taxonomy.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    siteId: input.siteId,
    prefix,
    name: input.name,
    hierarchical: input.hierarchical,
  });
  await deps.taxonomyRepository.saveTaxonomy(taxonomy);
  return taxonomy;
}

/**
 * A prefix is a URL segment, so it goes through the same `slugify` a
 * page's does — a dimension called "Categoria prodotti" must not put a
 * space in every one of its terms' addresses. An empty result is `null`
 * rather than an empty segment, which would produce `/it//espresso`.
 */
function normalizePrefix(prefix: string | null): string | null {
  if (prefix === null) return null;
  const slug = slugify(prefix);
  return slug === '' ? null : slug;
}

/** The name in whatever language it was given in — the prefix is one string for every locale, so the first one there is is as good as any. */
function defaultPrefixFrom(name: LocalizedText): string | null {
  const first = Object.values(name).find((value) => value.trim() !== '');
  return first ? normalizePrefix(first) : null;
}

export async function listTaxonomies(
  deps: TaxonomyDeps,
  tenantId: string,
  siteId: string,
): Promise<Taxonomy[]> {
  return deps.taxonomyRepository.listTaxonomiesBySite(tenantId, siteId);
}

export async function getTaxonomy(
  deps: TaxonomyDeps,
  tenantId: string,
  id: string,
): Promise<Taxonomy> {
  return loadTaxonomy(deps, tenantId, id);
}

export interface UpdateTaxonomyInput {
  tenantId: string;
  id: string;
  name?: LocalizedText;
  prefix?: string | null;
  hierarchical?: boolean;
  order?: number;
}

/**
 * Changing the prefix moves every term of this dimension to a new
 * address at once — which is why the repository rewrites their address
 * rows in the same transaction, and why the availability check runs
 * before any of it.
 */
export async function updateTaxonomy(
  deps: TaxonomyDeps,
  input: UpdateTaxonomyInput,
): Promise<Taxonomy> {
  const taxonomy = await loadTaxonomy(deps, input.tenantId, input.id);
  const prefixChanges =
    input.prefix !== undefined &&
    normalizePrefix(input.prefix) !== taxonomy.prefix;
  const nextPrefix = prefixChanges
    ? normalizePrefix(input.prefix ?? null)
    : taxonomy.prefix;

  if (prefixChanges) {
    await assertTaxonomyPrefixAvailable(deps, {
      tenantId: input.tenantId,
      siteId: taxonomy.siteId,
      prefix: nextPrefix,
      taxonomyId: taxonomy.id,
      locales: await siteLocales(deps, input.tenantId, taxonomy.siteId),
    });
  }

  if (input.hierarchical === false && taxonomy.hierarchical) {
    // Refused rather than flattened: turning nesting off with terms
    // already nested would move content nobody asked to move, and the
    // only honest answer is to let the person unpick the tree first.
    const terms = await deps.taxonomyRepository.listTermsByTaxonomy(
      input.tenantId,
      taxonomy.id,
    );
    if (terms.some((term) => term.parentId !== null)) {
      throw new TaxonomyNotHierarchicalError(taxonomy.id);
    }
  }

  if (input.name) taxonomy.rename(input.name);
  if (prefixChanges) taxonomy.setPrefix(nextPrefix);
  if (input.hierarchical !== undefined) {
    taxonomy.setHierarchical(input.hierarchical);
  }
  if (input.order !== undefined) taxonomy.setOrder(input.order);

  await deps.taxonomyRepository.saveTaxonomy(taxonomy);
  if (prefixChanges) {
    await deps.taxonomyRepository.updateTermAddressPrefix(
      input.tenantId,
      taxonomy.id,
      nextPrefix,
    );
  }
  return taxonomy;
}

/**
 * Deletes the dimension, its terms and their addresses (the database
 * cascades). The pages keep existing and simply stop being classified
 * along it — a classification is a view over content, never the content
 * itself.
 */
export async function deleteTaxonomy(
  deps: TaxonomyDeps,
  tenantId: string,
  id: string,
): Promise<void> {
  await loadTaxonomy(deps, tenantId, id);
  await deps.taxonomyRepository.deleteTaxonomy(tenantId, id);
}

export interface CreateTermInput {
  tenantId: string;
  taxonomyId: string;
  name: LocalizedText;
  /** Per locale. A locale left out means the term has no address in that language yet, which is a legitimate state. */
  slugs?: Record<string, string>;
  parentId?: string | null;
}

export async function createTerm(
  deps: TaxonomyDeps,
  input: CreateTermInput,
): Promise<Term> {
  const taxonomy = await loadTaxonomy(deps, input.tenantId, input.taxonomyId);
  if (input.parentId && !taxonomy.hierarchical) {
    throw new TaxonomyNotHierarchicalError(taxonomy.id);
  }
  if (input.parentId) {
    await loadTerm(deps, input.tenantId, input.parentId);
  }

  const slugs = normalizeSlugs(input.slugs ?? defaultSlugsFrom(input.name));
  for (const [locale, slug] of Object.entries(slugs)) {
    await assertTermAddressAvailable(deps, {
      tenantId: input.tenantId,
      siteId: taxonomy.siteId,
      locale,
      prefix: taxonomy.prefix,
      slug,
    });
  }

  const term = Term.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    siteId: taxonomy.siteId,
    taxonomyId: taxonomy.id,
    parentId: input.parentId ?? null,
    name: input.name,
    slugs,
  });
  await deps.taxonomyRepository.saveTerm(term);
  return term;
}

/** Every language the name was written in gets an address derived from it — the same `slugify` a page's slug goes through. */
function defaultSlugsFrom(name: LocalizedText): Record<string, string> {
  return Object.fromEntries(
    Object.entries(name)
      .map(([locale, value]) => [locale, slugify(value)])
      .filter(([, slug]) => slug !== ''),
  );
}

function normalizeSlugs(slugs: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(slugs)
      .map(([locale, slug]) => [locale, slugify(slug)])
      .filter(([, slug]) => slug !== ''),
  );
}

export async function listTerms(
  deps: TaxonomyDeps,
  tenantId: string,
  taxonomyId: string,
): Promise<Term[]> {
  return deps.taxonomyRepository.listTermsByTaxonomy(tenantId, taxonomyId);
}

export async function getTerm(
  deps: TaxonomyDeps,
  tenantId: string,
  id: string,
): Promise<Term> {
  return loadTerm(deps, tenantId, id);
}

export interface UpdateTermInput {
  tenantId: string;
  id: string;
  name?: LocalizedText;
  description?: LocalizedText;
  seoMeta?: LocalizedSeoMeta;
  /** Replaces the addresses wholesale: a locale left out of this map loses its address, which is how a term stops being published in a language. */
  slugs?: Record<string, string>;
  landingPageGroupId?: string | null;
  order?: number;
}

export async function updateTerm(
  deps: TaxonomyDeps,
  input: UpdateTermInput,
): Promise<Term> {
  const term = await loadTerm(deps, input.tenantId, input.id);
  const taxonomy = await loadTaxonomy(deps, input.tenantId, term.taxonomyId);

  if (input.slugs) {
    const slugs = normalizeSlugs(input.slugs);
    for (const [locale, slug] of Object.entries(slugs)) {
      await assertTermAddressAvailable(deps, {
        tenantId: input.tenantId,
        siteId: term.siteId,
        locale,
        prefix: taxonomy.prefix,
        slug,
        termId: term.id,
      });
    }
    for (const locale of Object.keys(term.slugs)) {
      if (!(locale in slugs)) term.setSlug(locale, null);
    }
    for (const [locale, slug] of Object.entries(slugs)) {
      term.setSlug(locale, slug);
    }
  }

  if (input.name) term.rename(input.name);
  if (input.description) term.setDescription(input.description);
  if (input.seoMeta) term.setSeoMeta(input.seoMeta);
  if (input.landingPageGroupId !== undefined) {
    term.setLandingPage(input.landingPageGroupId);
  }
  if (input.order !== undefined) term.setOrder(input.order);

  await deps.taxonomyRepository.saveTerm(term);
  return term;
}

export interface MoveTermInput {
  tenantId: string;
  id: string;
  parentId: string | null;
}

/**
 * Re-files a term under a different parent. The address does not change,
 * because it never contained the ancestors (docs/adr/0064) — which is
 * the whole reason reorganising a tree is safe here.
 */
export async function moveTerm(
  deps: TaxonomyDeps,
  input: MoveTermInput,
): Promise<Term> {
  const term = await loadTerm(deps, input.tenantId, input.id);
  const taxonomy = await loadTaxonomy(deps, input.tenantId, term.taxonomyId);
  if (input.parentId !== null && !taxonomy.hierarchical) {
    throw new TaxonomyNotHierarchicalError(taxonomy.id);
  }
  if (input.parentId !== null) {
    const parent = await loadTerm(deps, input.tenantId, input.parentId);
    if (parent.taxonomyId !== term.taxonomyId) {
      // Moving across dimensions is not a move, it is two edits — and
      // silently rewriting `taxonomyId` would take the term's address
      // with it, since the address carries its dimension's prefix.
      throw new TermNotFoundError(input.parentId);
    }
    await assertNoCycle(deps, input.tenantId, term.id, parent);
  }
  term.moveTo(input.parentId);
  await deps.taxonomyRepository.saveTerm(term);
  return term;
}

/**
 * Walks up from the intended parent: if the term being moved is anywhere
 * on that path, the move would detach the branch from its dimension
 * entirely — a loop with no root, invisible in every listing.
 */
async function assertNoCycle(
  deps: TaxonomyDeps,
  tenantId: string,
  movingId: string,
  parent: Term,
): Promise<void> {
  let current: Term | null = parent;
  while (current) {
    if (current.id === movingId) {
      throw new TermCycleError();
    }
    current = current.parentId
      ? await deps.taxonomyRepository.findTermById(tenantId, current.parentId)
      : null;
  }
}

export async function deleteTerm(
  deps: TaxonomyDeps,
  tenantId: string,
  id: string,
): Promise<void> {
  await loadTerm(deps, tenantId, id);
  await deps.taxonomyRepository.deleteTerm(tenantId, id);
}

export interface SetPageGroupTermsInput {
  tenantId: string;
  pageGroupId: string;
  termIds: string[];
}

/**
 * What a page is filed under, across every dimension at once — the whole
 * set, not a diff, because that is what the editor knows: the boxes that
 * are ticked.
 *
 * On the GROUP and not the translation: the Italian and the English
 * version of an article are the same article (docs/adr/0064).
 */
export async function setPageGroupTerms(
  deps: TaxonomyDeps,
  input: SetPageGroupTermsInput,
): Promise<string[]> {
  const unique = [...new Set(input.termIds)];
  for (const termId of unique) {
    await loadTerm(deps, input.tenantId, termId);
  }
  await deps.taxonomyRepository.setTermsForPageGroup(
    input.tenantId,
    input.pageGroupId,
    unique,
  );
  return unique;
}

export async function listPageGroupTerms(
  deps: TaxonomyDeps,
  tenantId: string,
  pageGroupId: string,
): Promise<string[]> {
  return deps.taxonomyRepository.listTermIdsForPageGroup(tenantId, pageGroupId);
}
