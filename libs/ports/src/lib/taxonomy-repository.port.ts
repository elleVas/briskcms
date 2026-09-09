import type { Taxonomy, Term } from '@brisk/domain-core';

/**
 * Terms and their dimensions, in one port rather than two.
 *
 * They are one aggregate in practice: changing a taxonomy's prefix
 * rewrites the address of every term under it, and a term's address row
 * has no meaning without the dimension it hangs from. Splitting them
 * would mean a use case orchestrating a transaction across two ports,
 * which is exactly the coordination the repository is supposed to hide.
 *
 * Every method takes `tenantId` explicitly, like every other repository
 * here: the database policy is the second barrier, not the first
 * (docs/adr/0002).
 */
export interface TaxonomyRepositoryPort {
  saveTaxonomy(taxonomy: Taxonomy): Promise<void>;
  findTaxonomyById(tenantId: string, id: string): Promise<Taxonomy | null>;
  listTaxonomiesBySite(tenantId: string, siteId: string): Promise<Taxonomy[]>;
  /**
   * Removes the dimension and, by cascade, its terms and their addresses.
   * What that means for the pages filed under them is decided in the use
   * case, not here.
   */
  deleteTaxonomy(tenantId: string, id: string): Promise<void>;

  /**
   * Writes the term AND its per-locale address rows, in one transaction:
   * a term whose slugs landed and whose row did not (or the reverse) is a
   * URL that resolves to nothing.
   */
  saveTerm(term: Term): Promise<void>;
  findTermById(tenantId: string, id: string): Promise<Term | null>;
  listTermsByTaxonomy(tenantId: string, taxonomyId: string): Promise<Term[]>;
  listTermsBySite(tenantId: string, siteId: string): Promise<Term[]>;
  deleteTerm(tenantId: string, id: string): Promise<void>;

  /**
   * Whoever already answers at this address, or `null`. The database
   * refuses a duplicate anyway — this exists so the refusal can be a
   * message about the term that is in the way rather than a constraint
   * violation.
   */
  findTermByAddress(
    tenantId: string,
    siteId: string,
    locale: string,
    prefix: string | null,
    slug: string,
  ): Promise<Term | null>;

  /**
   * Rewrites `route_prefix` on every address row of one dimension —
   * called when its prefix changes, in the same transaction as the
   * taxonomy itself.
   */
  updateTermAddressPrefix(
    tenantId: string,
    taxonomyId: string,
    prefix: string | null,
  ): Promise<void>;

  /** Which terms a page carries. */
  listTermIdsForPageGroup(
    tenantId: string,
    pageGroupId: string,
  ): Promise<string[]>;
  /** Replaces the whole set in one write — the editor sends what the page should have, not a diff. */
  setTermsForPageGroup(
    tenantId: string,
    pageGroupId: string,
    termIds: string[],
  ): Promise<void>;
  /** Every page group filed under a term — what the term's own page is a list of. */
  listPageGroupIdsForTerm(tenantId: string, termId: string): Promise<string[]>;
}
